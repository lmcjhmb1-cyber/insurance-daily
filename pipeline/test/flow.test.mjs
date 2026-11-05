// 쓰기, 검토, 올리기 흐름 시험 (가짜 모델로)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LLMClient } from '../llm.mjs';
import { createMockTransport, fixtureIssue } from '../mock.mjs';
import { finalizeIssue, sourcesOf } from '../write.mjs';
import { processIssue } from '../verify.mjs';
import { sanitizeSelection } from '../select.mjs';
import { validateIssue } from '../schema.mjs';
import { publish, parseCheckErrors } from '../publish.mjs';
import { runPipeline } from '../run.mjs';
import { loadContext } from '../context.mjs';
import { makeRepoCopy, sampleCandidates, writeCandidates } from './helpers.mjs';
import { REPO_ROOT } from '../run.mjs';

const quiet = async (fn) => { const o = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = o; } };
const ctx = loadContext(REPO_ROOT, '2026-11-06');
const assign = { key: 'i1', id: '2026-11-06-1', title: '시험 이슈', tag: '감독·계리', thread: { id: 'actuarial-supervision', name: '계리감독 강화' }, companies: [], jobs: ['계리'], comic: { include: true, outline: '' }, angle: '' };
const arts = [{ id: 'c1', source: '금융위원회', type: 'regulator', url: 'https://www.fsc.go.kr/no010101/1', text: '본문' }, { id: 'c2', source: '보험저널', type: 'press', url: 'https://www.insjournal.co.kr/news/articleView.html?idxno=7', text: '본문' }];
const common = (llm) => ({ writerModel: 'claude-sonnet-5-5', verifierModel: 'claude-opus-5-5', writerSystem: 'W', verifierSystem: 'V', date: '2026-11-06', assign, arts, termNames: [], ctx });

test('모델이 쓴 id, 날짜, 출처 주소는 무시하고 코드가 덮어쓴다', () => {
  const raw = { ...fixtureIssue(assign), id: 'x-1', date: '1999-01-01', sources: [{ name: '가짜', url: 'https://evil.example/' }], basic: true, frames: [] };
  const it = finalizeIssue(raw, assign, arts, '2026-11-06');
  assert.equal(it.id, '2026-11-06-1');
  assert.equal(it.date, '2026-11-06');
  assert.deepEqual(it.sources, [{ name: '금융위원회', url: 'https://www.fsc.go.kr/no010101/1' }, { name: '보험저널', url: 'https://www.insjournal.co.kr/news/articleView.html?idxno=7' }]);
  assert.ok(!('basic' in it) && !('frames' in it));
  assert.deepEqual(sourcesOf([arts[0], arts[0]]).length, 1);
  assert.deepEqual(validateIssue(it, ctx).errors, []);
});

test('견본 이슈가 엄격 규칙을 통과하고, 규칙 위반은 잡아낸다', () => {
  const ok = finalizeIssue(fixtureIssue(assign), assign, arts, '2026-11-06');
  assert.deepEqual(validateIssue(ok, ctx).errors, []);
  const bad = structuredClone(ok);
  bad.interview.guide += ' 면접에서 말해요';
  bad.chain = ['하나'];
  bad.pre = ['없는용어'];
  const e = validateIssue(bad, ctx).errors.join('|');
  assert.match(e, /면접/); assert.match(e, /chain/); assert.match(e, /pre/);
});

test('검토 통과: 쓰기 한 번, 검토 한 번', async () => {
  const llm = new LLMClient({ transport: createMockTransport() });
  const r = await processIssue(llm, common());
  assert.equal(r.status, 'passed');
  assert.equal(r.issue.id, '2026-11-06-1');
});

test('검토 지적 -> 고치기 -> 다시 검토 통과면 repaired', async () => {
  const llm = new LLMClient({ transport: createMockTransport({ failVerify: (l, n) => n === 1 }) });
  const r = await processIssue(llm, common());
  assert.equal(r.status, 'repaired');
});

test('고친 뒤에도 검토를 못 넘으면 버린다 (이유 기록)', async () => {
  const llm = new LLMClient({ transport: createMockTransport({ failVerify: () => true }) });
  const r = await processIssue(llm, common());
  assert.equal(r.status, 'dropped');
  assert.equal(r.issue, null);
  assert.match(r.reason, /검토 통과 못 함/);
});

test('모델이 거절하면 그 항목은 버리고 이유에 거절이라고 적는다', async () => {
  const llm = new LLMClient({ transport: createMockTransport({ refuse: (l) => l.startsWith('write:') }) });
  const r = await processIssue(llm, common());
  assert.equal(r.status, 'dropped');
  assert.match(r.reason, /거절/);
  assert.equal(llm.usage.get('claude-sonnet-5-5').refusals, 1);
});

test('검토 모델이 거절해도 올리지 않는다', async () => {
  const llm = new LLMClient({ transport: createMockTransport({ refuse: (l) => l.startsWith('verify:') }) });
  const r = await processIssue(llm, common());
  assert.equal(r.status, 'dropped');
});

test('JSON이 아닌 출력은 한 번 다시 받아본다', async () => {
  const llm = new LLMClient({ transport: createMockTransport({ badWriteOnce: () => true }) });
  const r = await processIssue(llm, common());
  assert.equal(r.status, 'passed');
});

test('예산이 바닥나면 새 작업을 멈추고 상태는 budget', async () => {
  const llm = new LLMClient({ transport: createMockTransport(), budgetUsd: 1e-9 });
  llm._account('claude-sonnet-5-5', { input_tokens: 1000, output_tokens: 1000 }); // 이미 초과
  const r = await processIssue(llm, common());
  assert.equal(r.status, 'budget');
  assert.equal(r.issue, null);
});

test('선택 결과를 걸러낸다: 다른 묶음, 얇은 자료만 있는 묶음, 없는 회사 이름', () => {
  const cands = sampleCandidates('2026-11-06');
  const bodies = new Map(cands.map((c) => [c.id, { text: '본문', thin: c.url.includes('fss.or.kr') }]));
  const sel = {
    issues: [
      { key: 'i1', title: 'A', article_ids: [cands[1].id, cands[0].id, cands[2].id], tag: 't', thread: { id: 'x', name: 'y' }, companies: ['없는회사', '삼성화재'], jobs: ['계리', '없는직무'], comic: { include: false, outline: '' }, angle: '' },
      { key: 'i2', title: '얇음', article_ids: [cands[4].id], tag: 't', thread: { id: 'x', name: 'y' }, companies: [], jobs: ['계리'], comic: { include: false, outline: '' }, angle: '' },
    ],
  };
  const out = sanitizeSelection(sel, { cands, bodies, ctx, limitIssues: 7 });
  assert.equal(out.issues.length, 1, '얇은 자료만 있는 이슈는 건너뛰어요');
  assert.deepEqual(out.issues[0].articleIds, [cands[0].id, cands[1].id], '같은 묶음만, 보도자료가 먼저');
  assert.deepEqual(out.issues[0].companies, ['삼성화재']);
  assert.deepEqual(out.issues[0].jobs, ['계리']);
  assert.ok(!('news' in out), '고르기는 이슈만 골라요');
  const lim = sanitizeSelection({ ...sel, issues: [sel.issues[0]] }, { cands, bodies, ctx, limitIssues: 0 });
  assert.equal(lim.issues.length, 0, '--limit-issues를 넘지 않아요');
});

test('검사 출력에서 오류 id를 뽑는다', () => {
  const out = '검사 대상: ...\n\n[오류] 2건\n - brief: 2건\n     2026-11-06-2: brief에 what이 없어요.\n     n-2026-11-06-1: title이 없어요.\n\n[주의] 1건\n     2026-11-01: 뭔가\n\n[요약]\n';
  assert.deepEqual(parseCheckErrors(out).map((e) => e.id), ['2026-11-06-2', 'n-2026-11-06-1']);
});

test('올리기: 검사에서 걸린 이슈는 빼고 깨끗한 상태에서 다시 합친다', async () => {
  const root = makeRepoCopy();
  const good = finalizeIssue(fixtureIssue(assign), assign, arts, '2026-11-06');
  const bad = { ...structuredClone(good), id: '2026-11-06-2' };
  delete bad.brief; // 검사기가 오류로 잡는 결함
  const news = { id: 'n-2026-11-06-1', date: '2026-11-06', companies: ['삼성화재'], kind: '기타', title: '시험 소식', text: '시험 요약', source: { name: '보험저널', url: 'https://www.insjournal.co.kr/news/articleView.html?idxno=7777' }, issue: '2026-11-06-2' };
  const before = fs.readFileSync(path.join(root, 'issues.js'), 'utf8');
  const r = await publish({ root, payload: { issues: [good, bad], news: [news], weekly: [] }, date: '2026-11-06', payloadFile: path.join(root, 'pipeline', 'out', 'p.json'), repair: null, log: () => {} });
  assert.equal(r.ok, true);
  assert.deepEqual(r.payload.issues.map((i) => i.id), ['2026-11-06-1']);
  assert.ok(!('issue' in r.payload.news[0]), '빠진 이슈를 가리키던 issue는 지운다');
  assert.ok(r.removed.includes('2026-11-06-2'));
  assert.notEqual(fs.readFileSync(path.join(root, 'issues.js'), 'utf8'), before);
  assert.ok(!fs.readFileSync(path.join(root, 'issues.js'), 'utf8').includes('"2026-11-06-2"'));
});

test('올리기: 새 항목과 관계없는 오류면 저장소를 원래대로 돌리고 실패', async () => {
  const root = makeRepoCopy();
  fs.appendFileSync(path.join(root, 'weekly.js'), '\nthrow new Error("깨짐");\n'); // 이미 깨진 저장소
  const good = finalizeIssue(fixtureIssue(assign), assign, arts, '2026-11-06');
  const before = fs.readFileSync(path.join(root, 'issues.js'), 'utf8');
  const r = await publish({ root, payload: { issues: [good], news: [], weekly: [] }, date: '2026-11-06', payloadFile: path.join(root, 'pipeline', 'out', 'p.json'), log: () => {} });
  assert.equal(r.ok, false);
  assert.equal(fs.readFileSync(path.join(root, 'issues.js'), 'utf8'), before);
});

test('실행 전체: 한 이슈가 검토에서 떨어지면 번호는 이어서 다시 매기고 news의 issue 참조도 정리', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const outDir = path.join(root, 'pipeline', 'out', 'D');
  const r = await quiet(() => runPipeline({
    mock: true, root, date: '2026-11-06', dryRun: true, outputDir: outDir, limitIssues: 7, budgetUsd: 5, env: {},
    writerModel: 'claude-sonnet-5-5', verifierModel: 'claude-opus-5-5',
    mockOpts: { failVerify: (l) => l === 'verify:2026-11-06-1' },
  }));
  const payload = JSON.parse(fs.readFileSync(path.join(outDir, 'payload.json'), 'utf8'));
  assert.equal(r.dropped.filter((d) => d.kind === '이슈').length, 1);
  assert.deepEqual(payload.issues.map((i) => i.id), payload.issues.map((_, k) => `2026-11-06-${k + 1}`));
  assert.ok(payload.news.every((n) => !n.issue || payload.issues.some((i) => i.id === n.issue)));
  assert.equal(r.publishOk, true);
});

test('실행 전체: 예산이 모자라면 검토 못 한 것은 올리지 않고 끝낸다', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const outDir = path.join(root, 'pipeline', 'out', 'E');
  const r = await quiet(() => runPipeline({
    mock: true, root, date: '2026-11-06', dryRun: false, outputDir: outDir, limitIssues: 7, budgetUsd: 0.0005, env: {},
    writerModel: 'claude-sonnet-5-5', verifierModel: 'claude-opus-5-5',
  }));
  assert.equal(r.changed, false);
  assert.equal(r.issueCount, 0);
  assert.ok(r.dropped.length >= 1);
});

test('실행 전체: 하이쿠 모델 조합도 돌고 모델별 비용 요약이 나온다', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const outDir = path.join(root, 'pipeline', 'out', 'F');
  const r = await quiet(() => runPipeline({
    mock: true, root, date: '2026-11-06', dryRun: true, outputDir: outDir, limitIssues: 2, budgetUsd: 5, env: {},
    writerModel: 'claude-haiku-5-5', verifierModel: 'claude-haiku-5-5',
  }));
  assert.equal(r.publishOk, true);
  assert.equal(r.published.issues, 2, '--limit-issues를 지켜요');
  assert.deepEqual(r.usage.map((u) => u.model), ['claude-haiku-5-5']);
  assert.match(fs.readFileSync(path.join(outDir, 'summary.md'), 'utf8'), /claude-haiku-5-5/);
});
