// 검토 단계: 기사 원문과 대조해서 맞지 않으면 한 번 고치고, 그래도 안 되면 버려요. 의심스러우면 올리지 않아요.
import { BudgetExceededError, FatalApiError, RefusalError } from './llm.mjs';
import { VERIFY_SCHEMA, NEWS_VERIFY_SCHEMA } from './schema.mjs';
import { verifyIssuePrompt, verifyNewsPrompt, verifyWeeklyPrompt } from './prompts.mjs';
import { repairIssue, writeIssue } from './write.mjs';

export async function verifyIssue(llm, { model, system, issue, arts, hints }) {
  const { json } = await llm.call({
    model, role: 'verify', label: `verify:${issue.id}`, system, schema: VERIFY_SCHEMA, maxTokens: 16000,
    user: verifyIssuePrompt({ issue, arts, hints }),
  });
  const problems = Array.isArray(json.problems) ? json.problems : [];
  return { ok: json.ok === true && problems.length === 0, problems };
}

// 이슈 하나의 전체 흐름: 쓰기 -> 검토 -> (문제 있으면) 고치기 -> 다시 검토. 결과 상태: passed, repaired, dropped, budget
export async function processIssue(llm, { writerModel, verifierModel, writerSystem, verifierSystem, date, assign, arts, termNames, ctx, log }) {
  const res = { key: assign.key, title: assign.title, status: 'dropped', reason: '', issue: null };
  try {
    const { issue, warnings } = await writeIssue(llm, { model: writerModel, system: writerSystem, date, assign, arts, termNames, ctx });
    let cur = issue;
    let v = await verifyIssue(llm, { model: verifierModel, system: verifierSystem, issue: cur, arts, hints: warnings });
    if (v.ok) {
      res.status = 'passed';
    } else {
      log?.(`  검토 지적 ${v.problems.length}건 -> 고쳐 쓰기: ${assign.title}`);
      const fixed = await repairIssue(llm, { model: writerModel, system: writerSystem, date, issue: cur, problems: v.problems, assign, arts, ctx });
      cur = fixed.issue;
      v = await verifyIssue(llm, { model: verifierModel, system: verifierSystem, issue: cur, arts, hints: fixed.warnings });
      if (v.ok) res.status = 'repaired';
      else {
        res.reason = '고친 뒤에도 검토 통과 못 함: ' + v.problems.slice(0, 2).map((p) => `${p.field} ${p.problem}`).join(' / ');
        return res;
      }
    }
    res.issue = cur;
    return res;
  } catch (e) {
    if (e instanceof FatalApiError) throw e;
    if (e instanceof BudgetExceededError) { res.status = 'budget'; res.reason = '예산 초과로 멈춤'; return res; }
    res.reason = e instanceof RefusalError ? `모델 거절(${e.category ?? '분류 없음'})` : e.message;
    return res;
  }
}

// 회사 소식은 한 번에 묶어서 검토하고 통과 못 한 건은 하나씩 버려요
export async function verifyNewsBatch(llm, { model, system, news, bodies, chunk = 12, log }) {
  const passed = [], dropped = [];
  for (let i = 0; i < news.length; i += chunk) {
    const part = news.slice(i, i + chunk);
    const arts = part.map((n) => ({ id: n._articleId, source: n.source.name, type: 'press', text: bodies.get(n._articleId).text.slice(0, 3500) }));
    try {
      const { json } = await llm.call({
        model, role: 'verify', label: `newsverify:${i / chunk + 1}`, system, schema: NEWS_VERIFY_SCHEMA, maxTokens: 16000,
        user: verifyNewsPrompt({ items: part.map((n) => ({ article_id: n._articleId, title: n.title, text: n.text, companies: n.companies })), arts }),
      });
      const got = new Map((json.results || []).map((r) => [r.article_id, r]));
      for (const n of part) {
        const r = got.get(n._articleId);
        if (r && r.ok === true) passed.push(n);
        else dropped.push({ title: n.title, reason: r ? r.problem || '검토 통과 못 함' : '검토 결과에 없음' });
      }
    } catch (e) {
      if (e instanceof FatalApiError) throw e;
      const why = e instanceof BudgetExceededError ? '예산 초과로 검토 못 함' : e instanceof RefusalError ? `모델 거절(${e.category ?? '분류 없음'})` : e.message;
      for (const n of part) dropped.push({ title: n.title, reason: why });
      log?.(`  회사 소식 검토 묶음 ${i / chunk + 1} 실패: ${why}`);
    }
  }
  return { passed, dropped };
}

export async function verifyWeekly(llm, { model, system, weekly, issues }) {
  const { json } = await llm.call({
    model, role: 'verify', label: 'verify:weekly', system, schema: VERIFY_SCHEMA, maxTokens: 12000,
    user: verifyWeeklyPrompt({ weekly, issues: issues.map((i) => ({ id: i.id, title: i.title, brief: i.brief, points: i.points, thread: i.thread })) }),
  });
  return json.ok === true && (json.problems || []).length === 0;
}
