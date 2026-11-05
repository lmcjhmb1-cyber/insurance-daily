// 새 구조(거르기 -> 본문 -> 고르기 -> 회사 소식 -> 이슈 -> 용어)에 대한 시험. 모두 가짜 모델과 가짜 기사 서버로만 돌려요.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runPipeline, parseArgs, DEFER_REASON } from '../run.mjs';
import { LLMClient } from '../llm.mjs';
import { createMockTransport } from '../mock.mjs';
import { MODELS, DEFAULT_WRITER_MODEL, DEFAULT_VERIFIER_MODEL, DEFAULT_CHEAP_MODEL } from '../config.mjs';
import { sanitizeTriage, runTriage, TRIAGE_MAX_ISSUES, TRIAGE_MAX_NEWS } from '../triage.mjs';
import { buildNews } from '../select.mjs';
import { pickLessonTerms, runLessons } from '../lessons.mjs';
import { validateLesson, NEWS_KINDS } from '../schema.mjs';
import { writeNews } from '../write.mjs';
import { loadContext } from '../context.mjs';
import { loadWindow } from '../../scripts/_lib.mjs';
import { MOCK_SENTINEL, fixtureLesson } from '../mock.mjs';
import { REPO_ROOT } from '../run.mjs';
import { makeRepoCopy, sampleCandidates, writeCandidates, candidate } from './helpers.mjs';

const quiet = async (fn) => { const o = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = o; } };
const base = { mock: true, limitIssues: 7, budgetUsd: 5, writerModel: 'claude-sonnet-5-5', verifierModel: 'claude-sonnet-5-5', cheapModel: 'claude-haiku-5-5', env: {} };
const ctx = loadContext(REPO_ROOT, '2026-11-06');

// ---------- 설정 ----------
test('기본값: 모델 역할, 하루 예산 0.8달러, effort 표', () => {
  assert.equal(DEFAULT_WRITER_MODEL, 'claude-sonnet-5-5');
  assert.equal(DEFAULT_VERIFIER_MODEL, 'claude-sonnet-5-5');
  assert.equal(DEFAULT_CHEAP_MODEL, 'claude-haiku-5-5');
  const o = parseArgs(['--date', '2026-11-06'], {});
  assert.deepEqual([o.writerModel, o.verifierModel, o.cheapModel, o.budgetUsd], ['claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 0.8]);
  const e = parseArgs(['--cheap-model', 'claude-sonnet-5-5'], { CHEAP_MODEL: 'claude-opus-5-5', DAILY_BUDGET_USD: '1.5' });
  assert.equal(e.cheapModel, 'claude-sonnet-5-5', '옵션이 환경변수보다 먼저');
  assert.equal(e.budgetUsd, 1.5);
  assert.equal(parseArgs([], { CHEAP_MODEL: 'claude-opus-5-5' }).cheapModel, 'claude-opus-5-5');
  assert.deepEqual(MODELS['claude-sonnet-5-5'].effort, { triage: 'low', select: 'low', write: 'medium', repair: 'medium', news: 'low', weekly: 'medium', verify: 'medium', lesson: 'medium' });
  const h = MODELS['claude-haiku-5-5'].effort;
  assert.deepEqual([h.triage, h.news, h.verify, h.lesson], ['medium', 'medium', 'high', 'high']);
  for (const m of Object.values(MODELS)) assert.ok(m.effort.triage && m.effort.lesson, '모든 모델 표에 triage, lesson이 있어요');
  assert.equal(new LLMClient({}).budgetUsd, 0.8);
});

// ---------- 거르기 ----------
const mk = (n, o = {}) => candidate(n, { date: '2026-11-04', title: `후보 ${n}`, url: `https://www.paper.co.kr/n/${n}`, group: n, ...o });

test('거르기: 없는 id를 빼고, 이슈 후보는 15사건, 회사 소식은 40건으로 자른다', () => {
  const items = Array.from({ length: 60 }, (_, i) => mk(i + 1, { companies: ['삼성화재'] }));
  const raw = { issue_ids: ['없는-id', ...items.slice(0, 30).map((c) => c.id), items[0].id], news_ids: ['x', ...items.map((c) => c.id)] };
  const t = sanitizeTriage(raw, items);
  assert.equal(t.issueGroups.size, TRIAGE_MAX_ISSUES);
  assert.deepEqual(t.issueIds, items.slice(0, TRIAGE_MAX_ISSUES).map((c) => c.id), '모델이 준 중요한 순서를 지켜요');
  assert.equal(t.newsIds.length, TRIAGE_MAX_NEWS);
  assert.ok(!t.newsIds.includes('x'));
  // 본문은 고른 기사들(이슈 15 + 소식 40 중 겹치는 것 제외)과 그 사건만 가져와요
  const ids = new Set(t.fetchList.map((c) => c.id));
  assert.ok(ids.size <= 40 && ids.has(items[0].id));
  assert.ok(!ids.has(items[59].id));
});

test('거르기: 회사 이름이 없는 기사는 회사 소식 후보에서 빠지고, 같은 사건 기사는 이슈 후보에서 한 번만', () => {
  const items = [mk(1, { group: 1 }), mk(2, { group: 1 }), mk(3, { group: 2, companies: ['한화생명'] })];
  const t = sanitizeTriage({ issue_ids: [items[0].id, items[1].id], news_ids: [items[0].id, items[2].id] }, items);
  assert.deepEqual(t.newsIds, [items[2].id]);
  assert.equal(t.issueGroups.size, 1);
  assert.deepEqual(t.issueIds, [items[0].id]);
});

test('거르기: 같은 사건의 형제를 사건마다 최대 3건 붙인다 (고른 기사, 보도자료, 점수 순)', () => {
  const items = [
    mk(1, { group: 7, score: 2 }), mk(2, { group: 7, score: 9 }), mk(3, { group: 7, score: 5, type: 'regulator' }),
    mk(4, { group: 7, score: 7 }), mk(5, { group: 8, score: 1 }), mk(6, { group: 9, score: 8 }),
  ];
  const t = sanitizeTriage({ issue_ids: [items[0].id, items[4].id], news_ids: [] }, items);
  const g7 = t.fetchList.filter((c) => c.group === 7).map((c) => c.id);
  assert.deepEqual(g7, [items[0].id, items[2].id, items[1].id], '고른 기사, 그다음 보도자료, 그다음 점수 높은 순');
  assert.equal(t.fetchList.filter((c) => c.group === 8).length, 1);
  assert.ok(!t.fetchList.some((c) => c.group === 9), '고르지 않은 사건은 가져오지 않아요');
  assert.ok([...t.issueGroups].every((g) => [7, 8].includes(g)));
});

test('거르기 호출: 제목·요약(120자)만 보내고 신뢰할 수 없는 자료라는 문장이 시스템 프롬프트에 있다', async () => {
  let seen;
  const inner = createMockTransport();
  const transport = async (p, meta) => { if (meta.label === 'triage') seen = p; return inner(p, meta); };
  const llm = new LLMClient({ transport });
  const items = sampleCandidates('2026-11-06').filter((c) => !c.used).map((c) => ({ ...c, summary: '가'.repeat(300), body: '이건 본문' }));
  await runTriage(llm, { model: 'claude-haiku-5-5', date: '2026-11-06', items });
  assert.equal(seen.model, 'claude-haiku-5-5');
  assert.equal(seen.output_config.effort, 'medium');
  assert.match(seen.system[0].text, /신뢰할 수 없는 자료/);
  assert.ok(seen.system[0].text.length < 1000, 'GUIDE 전체를 넣지 않아요');
  const sent = JSON.parse(seen.messages[0].content.match(/<후보목록>([\s\S]*)<\/후보목록>/)[1]);
  assert.deepEqual(Object.keys(sent[0]).sort(), ['companies', 'group', 'id', 'score', 'source', 'summary', 'title', 'type']);
  assert.ok(sent.every((c) => c.summary.length <= 121));
});

test('거르기가 실패하면 점수 순서로 대신 고르고 참고 사항에 남긴다', async () => {
  const llm = new LLMClient({ transport: createMockTransport({ refuse: (l) => l === 'triage' }) });
  const notes = [];
  const items = sampleCandidates('2026-11-06').filter((c) => !c.used);
  const t = await runTriage(llm, { model: 'claude-haiku-5-5', date: '2026-11-06', items, notes });
  assert.ok(t.issueGroups.size >= 2 && t.fetchList.length >= 4);
  assert.match(notes.join(), /거르기 실패/);
});

// ---------- 회사 소식 후보 확정 (buildNews) ----------
test('buildNews: 사건당 하나, 안 열린 기사는 같은 사건의 열린 형제로 대체, 이슈 key 연결', () => {
  const c = (id, group, o = {}) => ({ id, group, url: `https://p.example/${id}`, companies: ['삼성화재'], source: '신문', type: 'press', ...o });
  const cands = [c('a1', 1), c('a2', 1), c('b1', 2), c('c1', 3, { companies: ['없는회사'] }), c('d1', 4, { url: 'https://old.example/d1' }), c('e1', 5, { companies: [] })];
  const bodies = new Map([['a2', {}], ['b1', {}], ['c1', {}], ['d1', {}], ['e1', {}]]); // a1은 안 열림
  const issues = [{ key: 'i9', articleIds: ['b1'] }];
  const local = { ...ctx, newsUrls: new Set(['https://old.example/d1']) };
  const out = buildNews({ newsIds: ['a1', 'a2', 'b1', 'c1', 'd1', 'e1', 'nope'], cands, bodies, ctx: local, issues });
  assert.deepEqual(out.map((n) => n.articleId), ['a2', 'b1'], 'a1은 같은 사건의 열린 a2로 바뀌고, 사건당 하나만, 없는 회사/이미 올린 주소/회사 없음은 빠져요');
  assert.deepEqual(out.map((n) => n.issueKey), [null, 'i9']);
  assert.deepEqual(out[0].companies, ['삼성화재']);
  assert.ok(!('kind' in out[0]), '분류는 쓰기 단계에서 정해요');
});

test('writeNews: 모델이 정한 kind를 쓰고, 목록에 없으면 기타', async () => {
  const cands = [{ id: 'n1', source: '신문', type: 'press', url: 'https://p.example/n1', companies: ['삼성화재'] }, { id: 'n2', source: '신문', type: 'press', url: 'https://p.example/n2', companies: ['한화생명'] }];
  const bodies = new Map(cands.map((x) => [x.id, { text: '본문 글자' }]));
  const transport = async (p) => ({ model: p.model, stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: 'text', text: JSON.stringify({ items: [{ article_id: 'n1', kind: '실적', title: '제목 하나', text: '요약 하나예요.' }, { article_id: 'n2', kind: '이상한것', title: '제목 둘', text: '요약 둘이에요.' }] }) }] });
  const out = await writeNews(new LLMClient({ transport }), { model: 'claude-haiku-5-5', system: 'S', date: '2026-11-06', items: [{ articleId: 'n1', companies: ['삼성화재'], issueKey: null }, { articleId: 'n2', companies: ['한화생명'], issueKey: null }], cands, bodies, ctx });
  assert.deepEqual(out.map((n) => n.kind), ['실적', '기타']);
  assert.ok(NEWS_KINDS.includes('실적'));
});

// ---------- 용어 ----------
test('validateLesson: 견본은 통과하고 규칙 위반은 잡는다', () => {
  assert.deepEqual(validateLesson(fixtureLesson('용어')).errors, []);
  const bad = fixtureLesson('용어');
  bad.steps = bad.steps.slice(0, 2);
  bad.example.note = '그냥 계산이에요';
  bad.vs = [];
  bad.quiz[0].o = ['하나', '둘'];
  bad.quiz[1].a = 3;
  bad.related = ['하나'];
  bad.why += ' 면접에서 말해요 **짝이 안 맞아요';
  bad.easy += ' $$x';
  const e = validateLesson(bad).errors.join('|');
  for (const w of ['steps', '예시 숫자', 'vs', 'quiz 1', 'quiz 2', 'related', '면접', '\\*\\*', '\\$\\$']) assert.match(e, new RegExp(w));
});

const issueWith = (terms, pre = []) => ({ id: 'x', title: '시험 이슈', pre, terms: terms.map((t) => ({ t, d: `${t} 설명이에요` })) });

test('용어 고르기: lessons.js에 없는 용어만, 하루 최대 3개, 중복 없이 (pre 용어 먼저)', () => {
  const existing = new Set(['이미있음']);
  const got = pickLessonTerms([issueWith(['이미있음', '가', '나', '다'], ['다']), issueWith(['가', '라', '마'])], existing);
  assert.deepEqual(got.map((x) => x.term), ['다', '가', '나']);
  assert.deepEqual(pickLessonTerms([issueWith(['이미있음'])], existing), []);
});

test('용어 쓰기: 검토에 못 넘으면 그 용어만 빼고 기록, 예산이 모자라면 멈춘다', async () => {
  const issues = [issueWith(['가', '나', '다'])];
  const llm = new LLMClient({ transport: createMockTransport({ failLesson: (l) => l === 'lessonverify:나' }), budgetUsd: 5 });
  const r = await runLessons(llm, { model: 'claude-sonnet-5-5', verifierModel: 'claude-sonnet-5-5', system: 'W', verifierSystem: 'V', issues, existing: new Set() });
  assert.deepEqual(Object.keys(r.lessons), ['가', '다']);
  assert.deepEqual(r.dropped.map((d) => [d.kind, d.title]), [['용어', '나']]);
  assert.match(r.dropped[0].reason, /검토 통과 못 함/);
  assert.deepEqual(Object.keys(r.lessons.가).sort(), ['analogy', 'easy', 'example', 'quiz', 'related', 'steps', 'vs', 'why']);
  // 예산: 쓴 돈 + 0.04 > 예산이면 시작하지 않아요
  const tight = new LLMClient({ transport: createMockTransport(), budgetUsd: 0.03 });
  const r2 = await runLessons(tight, { model: 'claude-sonnet-5-5', verifierModel: 'claude-sonnet-5-5', system: 'W', verifierSystem: 'V', issues, existing: new Set() });
  assert.deepEqual(r2.lessons, {});
  assert.equal(tight.spent, 0, '호출 없이 멈춰요');
  assert.equal(r2.dropped.length, 3);
  // 일요일 주간 정리 몫을 남겨둬요
  const sun = new LLMClient({ transport: createMockTransport(), budgetUsd: 0.1 });
  const r3 = await runLessons(sun, { model: 'claude-sonnet-5-5', verifierModel: 'claude-sonnet-5-5', system: 'W', verifierSystem: 'V', issues, existing: new Set(), extraReserve: 0.15 });
  assert.deepEqual(r3.lessons, {});
});

test('용어 쓰기: JSON이 아닌 출력은 한 번 다시 받아본다', async () => {
  const llm = new LLMClient({ transport: createMockTransport({ badLessonOnce: () => true }) });
  const r = await runLessons(llm, { model: 'claude-sonnet-5-5', verifierModel: 'claude-sonnet-5-5', system: 'W', verifierSystem: 'V', issues: [issueWith(['가'])], existing: new Set() });
  assert.deepEqual(Object.keys(r.lessons), ['가']);
});

// ---------- 합치기: lessons ----------
test('merge.mjs: lessons를 합치되 이미 있는 키는 덮어쓰지 않고, 맨 위 주석과 CRLF를 지킨다', () => {
  const root = makeRepoCopy();
  const file = path.join(root, 'lessons.js');
  const before = fs.readFileSync(file, 'utf8');
  assert.ok(before.includes('\r\n'));
  const existingKey = '보험계약마진';
  const payload = { lessons: { [existingKey]: { easy: '덮어쓰면 안 돼요' }, 새시험용어: fixtureLesson('새시험용어'), '': { easy: 'x' } } };
  const pf = path.join(root, 'payload.json');
  fs.writeFileSync(pf, JSON.stringify(payload));
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'merge.mjs'), pf, `--root=${root}`], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /용어 학습\(lessons\.js\): 추가 1건, 건너뜀 2건/);
  const after = fs.readFileSync(file, 'utf8');
  assert.ok(after.startsWith(before.slice(0, before.indexOf('window.LESSONS'))), '맨 위 주석 그대로');
  assert.ok(!/[^\r]\n/.test(after), '줄바꿈은 CRLF 그대로');
  const L = loadWindow('lessons.js', root).LESSONS;
  const O = loadWindow('lessons.js', REPO_ROOT).LESSONS;
  assert.equal(JSON.stringify(L[existingKey]), JSON.stringify(O[existingKey]), '기존 용어는 그대로');
  assert.ok(L.새시험용어);
  assert.equal(Object.keys(L).length, Object.keys(O).length + 1);
  assert.ok(fs.readFileSync(path.join(root, 'data', 'lessons.js'), 'utf8').includes('새시험용어'), 'data/ 도 새로 만들어요');
  // 아무것도 추가하지 않으면 파일을 건드리지 않아요
  fs.writeFileSync(pf, JSON.stringify({ lessons: { [existingKey]: {} } }));
  const stamp = fs.readFileSync(file, 'utf8');
  spawnSync(process.execPath, [path.join(root, 'scripts', 'merge.mjs'), pf, `--root=${root}`], { cwd: root });
  assert.equal(fs.readFileSync(file, 'utf8'), stamp);
});

// ---------- 전체 흐름 ----------
test('실행 전체: 순서는 거르기 -> 고르기 -> 회사 소식 -> 이슈 -> 용어, 용어는 lessons.js에 합쳐진다', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const labels = [];
  const inner = createMockTransport();
  const transport = async (p, meta) => { labels.push(meta.label); return inner(p, meta); };
  const before = loadWindow('lessons.js', root).LESSONS;
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-06', dryRun: false, transport }));
  assert.equal(r.changed, true);
  const idx = (re) => labels.findIndex((l) => re.test(l));
  const order = [/^triage$/, /^select$/, /^news:1$/, /^newsverify:1$/, /^write:/, /^verify:2026/, /^lesson:/, /^lessonverify:/].map(idx);
  assert.ok(order.every((v) => v >= 0), labels.join());
  assert.deepEqual([...order].sort((a, b) => a - b), order, '순서: ' + labels.join());
  assert.equal(r.lessonCount, 2);
  const after = loadWindow('lessons.js', root).LESSONS;
  assert.deepEqual(Object.keys(after).filter((k) => !(k in before)).sort(), ['검증', '보험부채']);
  assert.equal(JSON.stringify(after.계리가정), JSON.stringify(before.계리가정), '이미 있던 용어는 그대로');
  assert.ok(!fs.readFileSync(path.join(root, 'lessons.js'), 'utf8').includes(MOCK_SENTINEL));
  const c = spawnSync(process.execPath, [path.join(root, 'scripts', 'check.mjs'), '--since', '2026-11-06'], { cwd: root, encoding: 'utf8' });
  assert.equal(c.status, 0, c.stdout);
  const news = loadWindow('news.js', root).NEWS.filter((n) => n.date === '2026-11-06');
  assert.ok(news.length >= 1 && news.every((n) => NEWS_KINDS.includes(n.kind)));
  assert.match(fs.readFileSync(path.join(root, 'pipeline', 'out', '2026-11-06', 'summary.md'), 'utf8'), /새 용어 2개/);
});

test('실행 전체: 연습 실행에서는 lessons.js가 그대로이고 payload에는 lessons가 있다', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const before = fs.readFileSync(path.join(root, 'lessons.js'), 'utf8');
  const outDir = path.join(root, 'pipeline', 'out', 'L');
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-06', dryRun: true, outputDir: outDir }));
  assert.equal(r.publishOk, true);
  assert.equal(fs.readFileSync(path.join(root, 'lessons.js'), 'utf8'), before);
  const payload = JSON.parse(fs.readFileSync(path.join(outDir, 'payload.json'), 'utf8'));
  assert.deepEqual(Object.keys(payload.lessons).sort(), ['검증', '보험부채']);
  assert.ok(!JSON.stringify(payload).includes(MOCK_SENTINEL));
});

test('실행 전체: 네이버 뉴스로 모은 후보의 출처는 실제 언론사 이름으로 올라간다', async () => {
  const root = makeRepoCopy();
  const items = sampleCandidates('2026-11-06').map((c) => (c.type === 'press' ? { ...c, source: '네이버 뉴스' } : c));
  writeCandidates(root, '2026-11-06', items);
  const outDir = path.join(root, 'pipeline', 'out', 'N');
  await quiet(() => runPipeline({ ...base, root, date: '2026-11-06', dryRun: true, outputDir: outDir }));
  const payload = JSON.parse(fs.readFileSync(path.join(outDir, 'payload.json'), 'utf8'));
  const names = [...payload.issues.flatMap((i) => i.sources), ...payload.news.map((n) => n.source)].map((s) => s.name);
  assert.ok(names.length >= 3);
  assert.ok(names.every((n) => n !== '네이버 뉴스'), names.join());
  assert.ok(names.includes('모의신문'));
});

test('실행 전체: 하루 예산 예측 - 이슈는 일부만 쓰고 남은 것은 미룸으로 기록, 회사 소식은 남는다', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const outDir = path.join(root, 'pipeline', 'out', 'B1');
  // 이슈 쓰기 한 번이 약 0.3달러가 되게 흉내 내요
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-06', dryRun: true, outputDir: outDir, budgetUsd: 0.9, mockOpts: { extraOutput: (l) => (l.startsWith('write:') ? 30000 : 0) } }));
  const deferred = r.dropped.filter((d) => d.reason === DEFER_REASON);
  assert.ok(r.published.issues >= 1 && r.published.issues < 3, `이슈 ${r.published.issues}개`);
  assert.equal(deferred.length, 3 - r.published.issues - r.dropped.filter((d) => d.kind === '이슈' && d.reason !== DEFER_REASON).length);
  assert.ok(deferred.length >= 1 && deferred.every((d) => d.kind === '이슈' && d.title));
  assert.ok(r.published.news >= 1, '회사 소식은 이슈보다 먼저 써서 남아요');
  assert.ok(r.costUsd <= 0.9);
  assert.equal(r.publishOk, true);
});

test('실행 전체: 고르기에서 예산이 바닥나도 예외 없이 바뀐 것 없이 끝낸다', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const outDir = path.join(root, 'pipeline', 'out', 'B2');
  const before = fs.readFileSync(path.join(root, 'issues.js'), 'utf8');
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-06', dryRun: false, outputDir: outDir, budgetUsd: 0.0001 }));
  assert.equal(r.changed, false);
  assert.ok(!r.failed);
  assert.equal(r.issueCount, 0);
  assert.match(r.notes.join(), /예산/);
  assert.equal(fs.readFileSync(path.join(root, 'issues.js'), 'utf8'), before);
});

test('실행 전체: 일요일에는 주간 정리 몫을 남기려고 이슈를 더 일찍 미룬다', async () => {
  const run = async (date, tag) => {
    const root = makeRepoCopy();
    writeCandidates(root, date, sampleCandidates(date));
    return quiet(() => runPipeline({ ...base, root, date, dryRun: true, outputDir: path.join(root, 'pipeline', 'out', tag), budgetUsd: 1.0, mockOpts: { extraOutput: (l) => (l.startsWith('write:') ? 30000 : 0) } }));
  };
  const weekday = await run('2026-11-06', 'W1');
  const sunday = await run('2026-11-08', 'W2');
  const deferredOf = (r) => r.dropped.filter((d) => d.reason === DEFER_REASON).length;
  assert.ok(deferredOf(sunday) >= deferredOf(weekday));
  assert.ok(sunday.published.issues <= weekday.published.issues);
});

test('실행 전체: 거른 결과에 없는 사건의 기사는 본문도 가져오지 않는다', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const fetched = [];
  const inner = (await import('../mock.mjs')).createMockFetch(sampleCandidates('2026-11-06'));
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-06', dryRun: true, outputDir: path.join(root, 'pipeline', 'out', 'T'), mock: false, transport: createMockTransport({ triageGroups: 1 }), fetchImpl: async (u, i) => { fetched.push(u); return inner(u, i); } }));
  assert.equal(r.triaged.issueGroups, 1);
  assert.ok(fetched.some((u) => u.includes('99001')) && fetched.some((u) => u.includes('99002')), '고른 사건과 그 형제 기사를 가져와요');
  assert.ok(!fetched.some((u) => u.includes('99005')), '고르지 않은 사건(회사 이름도 없는 금감원 자료)은 가져오지 않아요');
  assert.ok(!fetched.some((u) => u.includes('99006')), '이미 쓴 기사는 가져오지 않아요');
});
