// 용어 학습 단계: 이번에 올라갈 이슈의 용어 중 lessons.js에 아직 없는 것만, 하루 최대 3개 써요.
// 다른 시기의 빈 용어는 채우지 않아요. 쓴 뒤 한 번 검토하고, 통과하지 못하면 그 용어는 건너뛰어요(고치기 없음).
import { BudgetExceededError, FatalApiError, RefusalError } from './llm.mjs';
import { writeLesson } from './write.mjs';
import { verifyLesson } from './verify.mjs';

export const MAX_LESSONS = 3;
export const LESSON_STEP_USD = 0.04; // 용어 하나를 시작하기 전에 남아 있어야 하는 예산

const FIELDS = ['easy', 'analogy', 'steps', 'example', 'vs', 'why', 'quiz', 'related'];

// 올릴 이슈들의 terms 중 lessons.js에 없는 용어 (pre에 오른 용어를 먼저). 같은 이름은 한 번만.
export function pickLessonTerms(issues, existing, max = MAX_LESSONS) {
  const seen = new Set();
  const list = [];
  for (const is of issues) {
    const pre = new Set(is.pre || []);
    for (const t of is.terms || []) list.push({ term: t.t, d: t.d, issueTitle: is.title, pre: pre.has(t.t) });
  }
  const out = [];
  for (const it of [...list.filter((x) => x.pre), ...list.filter((x) => !x.pre)]) {
    if (!it.term || existing.has(it.term) || seen.has(it.term)) continue;
    seen.add(it.term);
    out.push(it);
    if (out.length >= max) break;
  }
  return out;
}

// 반환: { lessons: {용어: {...}}, dropped: [{kind, title, reason}] }
// extraReserve: 뒤에 꼭 남겨둬야 하는 예산(일요일 주간 정리 몫)
export async function runLessons(llm, { model, verifierModel, system, verifierSystem, issues, existing, extraReserve = 0, log = () => {} }) {
  const lessons = {};
  const dropped = [];
  const terms = pickLessonTerms(issues, existing);
  if (!terms.length) { log('  새로 채울 용어가 없어요.'); return { lessons, dropped }; }
  for (const t of terms) {
    if (llm.spent + LESSON_STEP_USD + extraReserve > llm.budgetUsd) {
      log('  예산이 모자라서 남은 용어는 다음으로 미뤄요.');
      dropped.push({ kind: '용어', title: t.term, reason: '하루 예산 때문에 미룸' });
      continue;
    }
    try {
      log(`용어 쓰는 중: ${t.term}`);
      const raw = await writeLesson(llm, { model, system, term: t.term, d: t.d, issueTitle: t.issueTitle });
      const lesson = Object.fromEntries(FIELDS.map((k) => [k, raw[k]]));
      const v = await verifyLesson(llm, { model: verifierModel, system: verifierSystem, term: t.term, lesson });
      if (!v.ok) {
        dropped.push({ kind: '용어', title: t.term, reason: '검토 통과 못 함: ' + v.problems.slice(0, 2).map((p) => `${p.field} ${p.problem}`).join(' / ') });
        continue;
      }
      lessons[t.term] = lesson;
    } catch (e) {
      if (e instanceof FatalApiError) throw e;
      const why = e instanceof BudgetExceededError ? '예산 초과로 멈춤' : e instanceof RefusalError ? `모델 거절(${e.category ?? '분류 없음'})` : e.message;
      dropped.push({ kind: '용어', title: t.term, reason: why });
      if (e instanceof BudgetExceededError) break;
    }
  }
  return { lessons, dropped };
}
