// 매일 이슈 올리기 파이프라인의 지휘자.
// 사용법: node pipeline/run.mjs [--date YYYY-MM-DD] [--dry-run] [--limit-issues N] [--mock]
//                               [--writer-model 모델] [--verifier-model 모델] [--output-dir 폴더]
// 환경변수: ANTHROPIC_API_KEY, WRITER_MODEL, VERIFIER_MODEL, DAILY_BUDGET_USD(기본 5)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { kstNow, addDays } from '../scripts/_lib.mjs';
import { DEFAULT_WRITER_MODEL, DEFAULT_VERIFIER_MODEL, modelInfo } from './config.mjs';
import { LLMClient, createRealTransport, FatalApiError, BudgetExceededError } from './llm.mjs';
import { fetchAll } from './fetch-articles.mjs';
import { loadContext, readGuide } from './context.mjs';
import { writerSystem, verifierSystem } from './prompts.mjs';
import { runSelect } from './select.mjs';
import { toArts, writeNews, writeWeekly } from './write.mjs';
import { processIssue, verifyNewsBatch, verifyWeekly, verifyIssue } from './verify.mjs';
import { repairIssue } from './write.mjs';
import { publish, copyRepo } from './publish.mjs';
import { createMockFetch, createMockTransport } from './mock.mjs';
import { log, pMap, money, weekday } from './util.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');

export function parseArgs(argv, env = {}) {
  const o = {
    date: null, dryRun: false, limitIssues: 7, mock: false,
    writerModel: env.WRITER_MODEL || DEFAULT_WRITER_MODEL,
    verifierModel: env.VERIFIER_MODEL || DEFAULT_VERIFIER_MODEL,
    outputDir: null,
    budgetUsd: env.DAILY_BUDGET_USD ? Number(env.DAILY_BUDGET_USD) : 5,
  };
  const val = (i, name) => { if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${name} 뒤에 값이 필요해요.`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--mock') o.mock = true;
    else if (a === '--date') o.date = val(i++, a);
    else if (a === '--limit-issues') o.limitIssues = Number(val(i++, a));
    else if (a === '--writer-model') o.writerModel = val(i++, a);
    else if (a === '--verifier-model') o.verifierModel = val(i++, a);
    else if (a === '--output-dir') o.outputDir = val(i++, a);
    else throw new Error('알 수 없는 옵션이에요: ' + a);
  }
  if (o.date && !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) throw new Error('--date는 YYYY-MM-DD 모양이어야 해요.');
  if (!Number.isInteger(o.limitIssues) || o.limitIssues < 0) throw new Error('--limit-issues는 0 이상의 정수예요.');
  if (!Number.isFinite(o.budgetUsd) || o.budgetUsd <= 0) throw new Error('DAILY_BUDGET_USD는 0보다 큰 숫자여야 해요.');
  if (!o.date) o.date = addDays(kstNow().date, -1); // 기본: 한국 시간 어제
  return o;
}

function loadCandidates(root, date) {
  const file = path.join(root, 'candidates', `${date}.json`);
  if (!fs.existsSync(file)) {
    log(`후보 파일이 없어서 먼저 모아요: node scripts/collect.mjs ${date}`);
    spawnSync(process.execPath, [path.join(root, 'scripts', 'collect.mjs'), date], { cwd: root, stdio: 'inherit' });
  }
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function runPipeline(opts) {
  const o = { root: REPO_ROOT, env: process.env, ...opts };
  const { root, date, env } = o;
  modelInfo(o.writerModel); modelInfo(o.verifierModel);
  if (!o.mock && !o.transport && !env.ANTHROPIC_API_KEY) throw new FatalApiError('ANTHROPIC_API_KEY가 없어요. 저장소 비밀값에 API 키를 넣어주세요.');
  const outDir = path.resolve(o.outputDir || path.join(root, 'pipeline', 'out', date + (o.dryRun ? '-dry' : '')));
  fs.mkdirSync(outDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idaily-run-'));

  const stats = { date, dryRun: o.dryRun, mock: o.mock, writerModel: o.writerModel, verifierModel: o.verifierModel, candidates: 0, fetched: 0, fetchFailed: [], selectedIssues: 0, selectedNews: 0, passed: 0, repaired: 0, dropped: [], newsPassed: 0, weekly: null, published: { issues: 0, news: 0, weekly: 0 }, publishOk: null, notes: [] };
  const llm = new LLMClient({ transport: o.transport || (o.mock ? createMockTransport(o.mockOpts) : await createRealTransport()), budgetUsd: o.budgetUsd });
  let payload = { issues: [], news: [], weekly: [] };

  const finish = (extra = {}) => {
    const result = writeOutputs({ outDir, stats, llm, payload, extra, env });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return result;
  };

  try {
    log(`=== 매일 이슈 올리기: ${date}${o.dryRun ? ' (연습 실행: 저장소는 바꾸지 않아요)' : ''}${o.mock ? ' [모의]' : ''} ===`);
    log(`글쓰기 모델 ${o.writerModel}, 검토 모델 ${o.verifierModel}, 하루 예산 ${money(o.budgetUsd)}`);

    // 1. 불러오기
    const file = loadCandidates(root, date);
    const items = (file?.items || []).filter((i) => !i.used);
    stats.candidates = items.length;
    if (!items.length) {
      log('후보 기사가 없어서 아무것도 바꾸지 않고 끝내요.');
      stats.notes.push('후보 기사 없음');
      return finish({ changed: false });
    }
    log(`후보 ${items.length}건 (이미 쓴 기사 ${((file.items || []).length - items.length)}건 제외)`);

    // 2. 본문 확인 (메모리에만 보관)
    const { bodies, failures } = await fetchAll(items, { fetchImpl: o.mock ? createMockFetch(items) : o.fetchImpl, log });
    stats.fetched = bodies.size; stats.fetchFailed = failures;
    const cands = items.filter((c) => bodies.has(c.id));
    if (!cands.length) {
      stats.notes.push('본문을 확인한 기사 없음');
      log('본문을 확인한 기사가 없어서 끝내요.');
      return finish({ changed: false });
    }

    // 3. 고르기
    const ctx = loadContext(root, date);
    const guide = readGuide(root);
    const wSys = writerSystem(guide), vSys = verifierSystem(guide);
    log('기사 고르는 중...');
    const sel = await runSelect(llm, { model: o.writerModel, system: wSys, date, cands, bodies, ctx, limitIssues: o.limitIssues, log });
    stats.selectedIssues = sel.issues.length; stats.selectedNews = sel.news.length;
    log(`고른 것: 이슈 ${sel.issues.length}개, 회사 소식 ${sel.news.length}건`);

    // 4~5. 이슈마다 쓰기 -> 검토 -> (고치기 -> 검토). 동시에 3개
    const assigns = sel.issues.map((s, i) => ({ ...s, id: `${date}-${ctx.lastIssueN + i + 1}` }));
    const artsOf = new Map(assigns.map((a) => [a.key, toArts(a.articleIds, cands, bodies)]));
    const results = await pMap(assigns, 3, async (assign) => {
      log(`쓰는 중: ${assign.title}`);
      const r = await processIssue(llm, { writerModel: o.writerModel, verifierModel: o.verifierModel, writerSystem: wSys, verifierSystem: vSys, date, assign, arts: artsOf.get(assign.key), termNames: ctx.terms, ctx, log });
      log(`  -> ${r.status}${r.reason ? ': ' + r.reason : ''}`);
      return r;
    });
    const survivors = results.filter((r) => r.issue);
    stats.passed = results.filter((r) => r.status === 'passed').length;
    stats.repaired = results.filter((r) => r.status === 'repaired').length;
    for (const r of results) if (!r.issue) stats.dropped.push({ kind: '이슈', title: r.title, reason: r.reason });
    // 버려진 이슈 때문에 번호가 비지 않게 다시 매겨요
    const finalId = new Map();
    survivors.forEach((r, k) => {
      const id = `${date}-${ctx.lastIssueN + k + 1}`;
      r.issue.id = id;
      assigns.find((a) => a.key === r.key).id = id;
      finalId.set(r.key, id);
    });
    const issues = survivors.map((r) => r.issue);

    // 회사 소식
    let news = [];
    if (sel.news.length) {
      log('회사 소식 쓰는 중...');
      let written = [];
      try {
        written = await writeNews(llm, { model: o.writerModel, system: wSys, date, items: sel.news, cands, bodies, ctx, log });
      } catch (e) {
        if (e instanceof FatalApiError) throw e;
        stats.notes.push('회사 소식 쓰기 중단: ' + e.message);
      }
      let vr = { passed: [], dropped: [] };
      if (written.length) vr = await verifyNewsBatch(llm, { model: o.verifierModel, system: vSys, news: written, bodies, log });
      vr.dropped.forEach((d) => stats.dropped.push({ kind: '회사 소식', ...d }));
      stats.newsPassed = vr.passed.length;
      news = vr.passed.map((n, j) => {
        const { _articleId, _issueKey, ...rest } = n;
        return { id: `n-${date}-${ctx.lastNewsN + j + 1}`, ...rest, ...(finalId.has(_issueKey) ? { issue: finalId.get(_issueKey) } : {}) };
      });
    }

    // 일요일이면 주간 큰 그림
    const weekly = [];
    if (weekday(date) === 0 && !ctx.weeklyIds.has(date)) {
      const start = addDays(date, -6);
      const weekIssues = [...issues, ...ctx.issues.filter((i) => !i.basic && i.date >= start && i.date <= date)].filter((i) => !i.basic);
      if (weekIssues.length >= 3) {
        try {
          const threadIds = [...new Set([...ctx.threads.keys(), ...issues.map((i) => i.thread.id)])];
          const w = await writeWeekly(llm, { model: o.writerModel, system: wSys, start, end: date, issues: weekIssues, threadIds });
          if (await verifyWeekly(llm, { model: o.verifierModel, system: vSys, weekly: w, issues: weekIssues })) weekly.push(w);
          else stats.dropped.push({ kind: '주간 정리', title: w.title, reason: '검토 통과 못 함' });
        } catch (e) {
          if (e instanceof FatalApiError) throw e;
          stats.dropped.push({ kind: '주간 정리', title: date, reason: e.message });
        }
      } else stats.notes.push(`주간 정리 건너뜀: 그 주 이슈 ${weekIssues.length}개 (3개 미만)`);
    }

    payload = { issues, news, weekly };
    if (!issues.length && !news.length) {
      stats.notes.push('올릴 내용이 없음');
      log('검토를 통과한 내용이 없어서 아무것도 바꾸지 않아요.');
      return finish({ changed: false });
    }

    // 6. 올리기 (연습 실행이면 저장소 복사본에서만 시험)
    log(o.dryRun ? '시험 합치기 중 (저장소 복사본에서)...' : '합치기와 검사 중...');
    const target = o.dryRun ? copyRepo(root) : root;
    const repair = async (issue, msgs) => {
      const assign = assigns.find((a) => a.id === issue.id);
      const arts = artsOf.get(assign.key);
      const fixed = await repairIssue(llm, { model: o.writerModel, system: wSys, date, issue, problems: msgs.map((m) => ({ field: '-', claim: '-', problem: m, fix: '-' })), assign, arts, ctx });
      const v = await verifyIssue(llm, { model: o.verifierModel, system: vSys, issue: fixed.issue, arts, hints: fixed.warnings });
      return v.ok ? fixed.issue : null;
    };
    let pub;
    try {
      pub = await publish({ root: target, payload, date, payloadFile: path.join(tmpDir, 'payload.json'), repair, log });
    } finally {
      if (o.dryRun) fs.rmSync(target, { recursive: true, force: true });
    }
    payload = pub.payload;
    stats.publishOk = pub.ok;
    for (const id of pub.removed) stats.dropped.push({ kind: '검사 실패로 뺌', title: id, reason: '합친 뒤 검사에서 오류' });
    if (!pub.ok) {
      stats.notes.push('합치기 또는 검사 실패: 올리지 않았어요');
      payload = { issues: [], news: [], weekly: [] };
      return finish({ changed: false, failed: true });
    }
    stats.published = { issues: payload.issues.length, news: payload.news.length, weekly: payload.weekly.length };
    return finish({ changed: !o.dryRun && (payload.issues.length > 0 || payload.news.length > 0) });
  } catch (e) {
    if (e instanceof FatalApiError) { stats.notes.push('치명적 API 오류: ' + e.message); finish({ changed: false, failed: true }); throw e; }
    if (e instanceof BudgetExceededError) { stats.notes.push(e.message); finish({ changed: false, failed: true }); throw e; }
    stats.notes.push('실행 오류: ' + e.message);
    finish({ changed: false, failed: true });
    throw e;
  }
}

// ---------- 결과 정리: 파일과 한국어 요약 ----------
function writeOutputs({ outDir, stats, llm, payload, extra, env }) {
  const usage = [...llm.usage].map(([model, u]) => ({ model, ...u }));
  const role = (m) => [m === stats.writerModel ? '글쓰기' : null, m === stats.verifierModel ? '검토' : null].filter(Boolean).join('·');
  const lines = [];
  lines.push(`## 매일 이슈 올리기: ${stats.date}${stats.dryRun ? ' (연습 실행)' : ''}${stats.mock ? ' [모의]' : ''}`, '');
  lines.push(`- 후보 ${stats.candidates}건, 본문 확인 성공 ${stats.fetched}건, 실패 ${stats.fetchFailed.length}건`);
  for (const f of stats.fetchFailed) lines.push(`  - 실패: ${f.title} (${f.reason})`);
  lines.push(`- 고른 것: 이슈 ${stats.selectedIssues}개, 회사 소식 ${stats.selectedNews}건`);
  lines.push(`- 검토: 한 번에 통과 ${stats.passed}개, 고친 뒤 통과 ${stats.repaired}개, 회사 소식 통과 ${stats.newsPassed}건`);
  lines.push(`- 올림${stats.dryRun ? '(시험 합치기 결과)' : ''}: 이슈 ${stats.published.issues}개, 회사 소식 ${stats.published.news}건, 주간 정리 ${stats.published.weekly}건` + (stats.publishOk === false ? ' [합치기/검사 실패]' : ''));
  if (stats.dropped.length) { lines.push(`- 버린 것 ${stats.dropped.length}건`); for (const d of stats.dropped) lines.push(`  - ${d.kind}: ${d.title} (${d.reason})`); }
  for (const n of stats.notes) lines.push(`- 참고: ${n}`);
  lines.push('', `### 모델별 사용량과 예상 비용 (모델: 글쓰기 ${stats.writerModel}, 검토 ${stats.verifierModel})`, '', '| 모델 | 역할 | 호출 | 입력 | 출력 | 캐시 읽기 | 캐시 쓰기 | 거절 | 비용 |', '|---|---|---|---|---|---|---|---|---|');
  for (const u of usage) lines.push(`| ${u.model} | ${role(u.model)} | ${u.calls} | ${u.input} | ${u.output} | ${u.cacheRead} | ${u.cacheWrite} | ${u.refusals} | ${money(u.cost)} |`);
  lines.push('', `**합계 ${money(llm.spent)}** (하루 예산 ${money(llm.budgetUsd)})` + (llm.spent >= llm.budgetUsd ? ' - 예산을 넘어서 새 작업을 멈췄어요' : ''));
  const summary = lines.join('\n') + '\n';
  const result = { ...stats, ...extra, usage, costUsd: llm.spent, budgetUsd: llm.budgetUsd, issueCount: payload.issues.length, newsCount: payload.news.length };
  fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify(payload, null, 2) + '\n'); // 기사 본문은 들어 있지 않아요
  fs.writeFileSync(path.join(outDir, 'summary.md'), summary);
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('\n' + summary);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, summary + '\n');
  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `changed=${result.changed ? 'true' : 'false'}\ndate=${stats.date}\nissues=${payload.issues.length}\nnews=${payload.news.length}\nout_dir=${outDir}\n`);
  }
  return result;
}

// ---------- 명령줄 ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    try {
      const opts = parseArgs(process.argv.slice(2), process.env);
      const r = await runPipeline(opts);
      process.exit(r.failed ? 1 : 0);
    } catch (e) {
      console.error('\n실패: ' + e.message);
      process.exit(1);
    }
  })();
}
