// 글쓰기 단계: 이슈, 회사 소식, 주간 정리. 모델이 쓴 id, 출처 주소는 믿지 않고 코드가 덮어써요.
import { OutputParseError, BudgetExceededError, FatalApiError } from './llm.mjs';
import { NEWS_WRITE_SCHEMA, validateIssue, validateNews, validateWeekly } from './schema.mjs';
import { issuePrompt, repairPrompt, newsPrompt, weeklyPrompt } from './prompts.mjs';
import { clip } from './util.mjs';

export class WriteFailure extends Error {}

// 출처는 배정된 기사의 이름과 실제 주소만. 중복 주소는 한 번만.
export function sourcesOf(arts) {
  const seen = new Set();
  return arts.filter((a) => (seen.has(a.url) ? false : seen.add(a.url))).map((a) => ({ name: a.source, url: a.url }));
}

// 모델 출력에서 코드가 정하는 필드(id, date, sources 등)를 덮어써요
export function finalizeIssue(raw, assign, arts, date) {
  const { id: _i, date: _d, sources: _s, basic: _b, frames: _f, ...rest } = raw;
  const it = { id: assign.id, date, ...rest, tag: assign.tag, thread: assign.thread, jobs: assign.jobs };
  if (assign.companies.length) it.companies = assign.companies; else delete it.companies;
  if (!assign.comic.include) delete it.comic;
  it.sources = sourcesOf(arts);
  return it;
}

// 호출 → 검사 → 문제가 있으면 문제 목록을 알려주고 한 번만 다시 써요 (JSON 읽기 실패도 같은 방식)
async function callChecked(llm, { buildUser, check, ...params }) {
  let errors = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let r;
    try {
      r = await llm.call({ ...params, user: buildUser(errors) });
    } catch (e) {
      if (e instanceof OutputParseError && attempt === 0) { errors = [e.message]; continue; }
      throw e;
    }
    const res = check(r.json);
    if (!res.errors.length) return res;
    errors = res.errors;
  }
  throw new WriteFailure('검사를 통과하지 못했어요: ' + errors.slice(0, 4).join(' / '));
}

export function toArts(ids, cands, bodies, maxChars = 12000) {
  const byId = new Map(cands.map((c) => [c.id, c]));
  return ids.map((id) => ({ ...byId.get(id), text: clip(bodies.get(id).text, maxChars) }));
}

export async function writeIssue(llm, { model, system, date, assign, arts, termNames, ctx }) {
  const res = await callChecked(llm, {
    model, role: 'write', label: `write:${assign.key}`, system, maxTokens: 32000,
    buildUser: (errors) => issuePrompt({ date, assign: publicAssign(assign), arts, termNames, errors }),
    check: (json) => {
      const issue = finalizeIssue(json, assign, arts, date);
      const v = validateIssue(issue, ctx);
      return { errors: v.errors, warnings: v.warnings, value: issue };
    },
  });
  return { issue: res.value, warnings: res.warnings };
}

const publicAssign = (a) => ({ id: a.id, title: a.title, tag: a.tag, thread: a.thread, companies: a.companies, jobs: a.jobs, comic: a.comic, angle: a.angle });

// 검토에서 지적받은 부분만 고치기 (소넷 등 글쓰기 모델)
export async function repairIssue(llm, { model, system, date, issue, problems, assign, arts, ctx }) {
  const res = await callChecked(llm, {
    model, role: 'repair', label: `repair:${assign.key}`, system, maxTokens: 32000,
    buildUser: (errors) => repairPrompt({ date, issue, problems: errors ? [...problems, ...errors.map((e) => ({ field: '-', claim: '-', problem: e, fix: '-' }))] : problems, arts }),
    check: (json) => {
      const fixed = finalizeIssue(json, assign, arts, date);
      const v = validateIssue(fixed, ctx);
      return { errors: v.errors, warnings: v.warnings, value: fixed };
    },
  });
  return { issue: res.value, warnings: res.warnings };
}

// 회사 소식: 10건씩 묶어서 한 번에. id는 나중에 코드가 붙여요.
export async function writeNews(llm, { model, system, date, items, cands, bodies, ctx, chunk = 10, log }) {
  const out = [];
  for (let i = 0; i < items.length; i += chunk) {
    const part = items.slice(i, i + chunk);
    const arts = toArts(part.map((x) => x.articleId), cands, bodies, 3500);
    try {
      const res = await callChecked(llm, {
        model, role: 'news', label: `news:${i / chunk + 1}`, system, schema: NEWS_WRITE_SCHEMA, maxTokens: 16000,
        buildUser: () => newsPrompt({ items: arts }),
        check: (json) => {
          const got = new Map((json.items || []).map((x) => [x.article_id, x]));
          const value = [], errors = [];
          for (const sel of part) {
            const w = got.get(sel.articleId);
            const c = arts.find((a) => a.id === sel.articleId);
            if (!w) { errors.push(`${sel.articleId}: 결과에 없어요.`); continue; }
            const n = { date, companies: sel.companies, kind: sel.kind, title: String(w.title).trim(), text: String(w.text).trim(), source: { name: c.source, url: c.url }, _articleId: sel.articleId, _issueKey: sel.issueKey };
            const v = validateNews(n, ctx);
            if (v.errors.length) errors.push(`${sel.articleId}: ${v.errors.join(', ')}`); else value.push(n);
          }
          return { errors: [], value, problems: errors };
        },
      });
      res.problems?.forEach((p) => log?.(`  회사 소식 제외: ${p}`));
      out.push(...res.value);
    } catch (e) {
      if (e instanceof BudgetExceededError || e instanceof FatalApiError) throw e;
      log?.(`  회사 소식 묶음 ${i / chunk + 1} 실패: ${e.message}`);
    }
  }
  return out;
}

export async function writeWeekly(llm, { model, system, start, end, issues, threadIds }) {
  const brief = issues.map((i) => ({ id: i.id, date: i.date, tag: i.tag, title: i.title, thread: i.thread, brief: i.brief, points: i.points }));
  const res = await callChecked(llm, {
    model, role: 'weekly', label: 'weekly', system, maxTokens: 16000,
    buildUser: (errors) => weeklyPrompt({ start, end, issues: brief, threadIds }) + (errors ? `\n[이전 시도의 문제]\n${errors.join('\n')}` : ''),
    check: (json) => {
      const w = { ...json, id: end, start, end };
      return { errors: validateWeekly(w, { threadIds: new Set(threadIds), start, end }).errors, value: w };
    },
  });
  return res.value;
}
