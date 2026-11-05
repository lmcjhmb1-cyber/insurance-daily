// 오늘 올릴 이슈와 회사 소식을 고르는 단계. 모델의 선택은 코드가 한 번 더 걸러요.
import { SELECT_SCHEMA, NEWS_KINDS } from './schema.mjs';
import { selectPrompt } from './prompts.mjs';
import { clip } from './util.mjs';

// cands: 본문 확인을 통과한 후보. bodies: id -> { text, thin }
export async function runSelect(llm, { model, system, date, cands, bodies, ctx, limitIssues, log }) {
  const candidates = cands.map((c) => ({
    id: c.id, source: c.source, type: c.type, title: c.title, date: c.date, group: c.group,
    companies: c.companies, score: c.score, 짧음: !!bodies.get(c.id)?.thin,
    body: clip(bodies.get(c.id).text, 1500),
  }));
  const user = selectPrompt({ date, limit: limitIssues, candidates, ctx });
  const { json } = await llm.call({ model, role: 'select', label: 'select', system, user, schema: SELECT_SCHEMA, maxTokens: 24000 });
  return sanitizeSelection(json, { cands, bodies, ctx, limitIssues, log });
}

// 모델이 고른 것을 규칙에 맞게 걸러요 (없는 기사 id, 다른 묶음, 없는 회사 이름 등)
export function sanitizeSelection(sel, { cands, bodies, ctx, limitIssues, log = () => {} }) {
  const byId = new Map(cands.map((c) => [c.id, c]));
  const used = new Set();
  const issues = [];
  const keys = new Map();
  for (const raw of sel.issues || []) {
    if (issues.length >= limitIssues) { log(`  이슈 개수 제한(${limitIssues}개)으로 건너뛰었어요: ${raw.title}`); continue; }
    const first = (raw.article_ids || []).map((id) => byId.get(id)).find(Boolean);
    if (!first) { log(`  건너뜀(후보에 없는 기사): ${raw.title}`); continue; }
    let arts = (raw.article_ids || []).map((id) => byId.get(id)).filter((c) => c && c.group === first.group && !used.has(c.id));
    arts = [...new Set(arts)];
    if (!arts.some((c) => !bodies.get(c.id).thin)) {
      // 얇은 자료뿐이면 같은 묶음의 언론 기사를 붙여요. 없으면 건너뛰어요.
      const extra = cands.filter((c) => c.group === first.group && !used.has(c.id) && !bodies.get(c.id).thin && !arts.includes(c));
      if (!extra.length) { log(`  건너뜀(자료가 너무 얇아요): ${raw.title}`); continue; }
      arts.push(...extra.slice(0, 2));
    }
    arts.sort((a, b) => (b.type === 'regulator') - (a.type === 'regulator')); // 보도자료를 1차 출처로
    const jobs = (raw.jobs || []).filter((j) => ctx.jobs.includes(j)).slice(0, 3);
    if (!jobs.length || !raw.tag || !raw.thread?.id || !raw.thread?.name) { log(`  건너뜀(tag, thread, jobs 문제): ${raw.title}`); continue; }
    arts.forEach((a) => used.add(a.id));
    const key = raw.key || `i${issues.length + 1}`;
    keys.set(key, true);
    issues.push({
      key, title: raw.title, articleIds: arts.map((a) => a.id), tag: raw.tag, thread: { id: raw.thread.id, name: raw.thread.name },
      companies: (raw.companies || []).filter((c) => ctx.companies.includes(c)), jobs,
      comic: { include: !!raw.comic?.include, outline: raw.comic?.outline || '' }, angle: raw.angle || '',
    });
  }
  const news = [];
  const seen = new Set();
  for (const n of sel.news || []) {
    const c = byId.get(n.article_id);
    if (!c || seen.has(c.id)) continue;
    const companies = (n.companies?.length ? n.companies : c.companies || []).filter((x) => ctx.companies.includes(x));
    if (!companies.length) continue;
    if (ctx.newsUrls.has(c.url)) continue;
    seen.add(c.id);
    news.push({ articleId: c.id, companies, kind: NEWS_KINDS.includes(n.kind) ? n.kind : '기타', issueKey: keys.has(n.issue_ref) ? n.issue_ref : null });
  }
  return { issues, news };
}
