// 거르기 단계: 본문을 가져오기 전에 제목과 요약만으로 값싸게 후보를 줄여요.
// 하루 후보가 300건이 넘어서 전부 본문을 읽으면 예산이 모자라요. 싼 모델이 이슈 후보와 회사 소식 후보만 골라요.
import { FatalApiError } from './llm.mjs';
import { TRIAGE_SCHEMA } from './schema.mjs';
import { triageSystem, triagePrompt } from './prompts.mjs';
import { clip } from './util.mjs';

export const TRIAGE_MAX_ISSUES = 15; // 이슈 후보 사건
export const TRIAGE_MAX_NEWS = 40; // 회사 소식 후보 기사
export const SIBLINGS_PER_EVENT = 3; // 사건마다 본문을 가져올 기사 수(원문이 안 열릴 때를 대비한 예비 포함)

// 같은 group이 같은 사건. group이 없는 후보는 혼자 한 사건이에요.
export const groupOf = (c) => (c.group === undefined || c.group === null ? `solo:${c.id}` : c.group);

// items: used가 아닌 후보 전체. 반환: { issueGroups:Set, newsIds:[], fetchList:[후보...], issueIds:[] }
export async function runTriage(llm, { model, date, items, log = () => {}, notes = [] }) {
  const system = triageSystem();
  const candidates = items.map((c) => ({
    id: c.id, source: c.source, type: c.type, title: c.title, summary: clip(String(c.summary || ''), 120),
    companies: c.companies || [], group: c.group, score: c.score,
  }));
  let json;
  try {
    ({ json } = await llm.call({ model, role: 'triage', label: 'triage', system, user: triagePrompt({ date, candidates, maxIssues: TRIAGE_MAX_ISSUES, maxNews: TRIAGE_MAX_NEWS }), schema: TRIAGE_SCHEMA, maxTokens: 12000 }));
  } catch (e) {
    if (e instanceof FatalApiError) throw e;
    // 거르기가 실패해도 하루를 통째로 버리지 않도록 점수로 대신 골라요
    const why = `거르기 실패(${e.message}) - 점수 순서로 대신 골랐어요`;
    log('  ' + why);
    notes.push(why);
    json = fallbackPick(items);
  }
  return sanitizeTriage(json, items, log);
}

// 모델 없이 고르기: 점수가 높은 사건 순서의 이슈 후보, companies가 붙은 기사 중 사건마다 하나
export function fallbackPick(items) {
  const byScore = [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
  const seen = new Set();
  const issue_ids = [];
  for (const c of byScore) if (!seen.has(groupOf(c))) { seen.add(groupOf(c)); issue_ids.push(c.id); }
  return { issue_ids, news_ids: byScore.filter((c) => c.companies?.length).map((c) => c.id) };
}

// 모델이 고른 것을 코드가 한 번 더 걸러요 (없는 id, 중복, 개수 상한) 그리고 같은 사건의 형제 기사를 붙여요
export function sanitizeTriage(raw, items, log = () => {}) {
  const byId = new Map(items.map((c) => [c.id, c]));
  const pickIds = (ids, accept) => {
    const out = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      const c = byId.get(id);
      if (!c) { log(`  거르기: 후보에 없는 id라서 뺐어요 (${String(id).slice(0, 40)})`); continue; }
      if (out.includes(id) || !accept(c)) continue;
      out.push(id);
    }
    return out;
  };

  // 이슈 후보: 사건(group)마다 하나, 최대 15사건, 모델이 준 중요한 순서 그대로
  const issueGroups = new Set();
  const issueIds = [];
  for (const id of pickIds(raw?.issue_ids, () => true)) {
    const g = groupOf(byId.get(id));
    if (issueGroups.has(g)) continue;
    if (issueGroups.size >= TRIAGE_MAX_ISSUES) { log(`  거르기: 이슈 후보 상한(${TRIAGE_MAX_ISSUES}사건)을 넘어서 뺐어요`); break; }
    issueGroups.add(g);
    issueIds.push(id);
  }
  // 회사 소식 후보: 회사 이름이 붙은 기사만, 최대 40건
  const newsIds = pickIds(raw?.news_ids, (c) => c.companies?.length > 0).slice(0, TRIAGE_MAX_NEWS);

  // 본문을 가져올 목록: 고른 기사가 속한 사건마다 최대 3건 (고른 기사, 보도자료, 점수 순)
  const chosen = [...issueIds, ...newsIds];
  const chosenRank = new Map(chosen.map((id, k) => [id, k]));
  const groupsInOrder = [];
  for (const id of chosen) { const g = groupOf(byId.get(id)); if (!groupsInOrder.includes(g)) groupsInOrder.push(g); }
  const fetchList = [];
  for (const g of groupsInOrder) {
    const members = items.filter((c) => groupOf(c) === g);
    members.sort((a, b) => {
      const ca = chosenRank.has(a.id) ? 0 : 1, cb = chosenRank.has(b.id) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      if (ca === 0) return chosenRank.get(a.id) - chosenRank.get(b.id);
      return (b.type === 'regulator') - (a.type === 'regulator') || (b.score || 0) - (a.score || 0);
    });
    fetchList.push(...members.slice(0, SIBLINGS_PER_EVENT));
  }
  return { issueGroups, issueIds, newsIds, fetchList };
}
