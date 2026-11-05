// 전체 흐름 시험: --mock으로 네트워크와 API 키 없이 저장소 복사본에서 끝까지 돌려요.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runPipeline, REPO_ROOT } from '../run.mjs';
import { makeRepoCopy, sampleCandidates, writeCandidates } from './helpers.mjs';
import { loadWindow } from '../../scripts/_lib.mjs';
import { MOCK_SENTINEL } from '../mock.mjs';

const quiet = async (fn) => {
  const orig = console.log;
  console.log = () => {};
  try { return await fn(); } finally { console.log = orig; }
};
const base = { mock: true, limitIssues: 7, budgetUsd: 5, writerModel: 'claude-sonnet-5-5', verifierModel: 'claude-opus-5-5', env: {} };

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === 'node_modules' || f.name === '.git') continue;
    const p = path.join(dir, f.name);
    f.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const leaks = (root) => walk(root).filter((f) => fs.readFileSync(f, 'utf8').includes(MOCK_SENTINEL));

test('--mock --dry-run: 저장소는 그대로, 시험 합치기와 검사는 통과, 본문은 어디에도 없다', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const before = fs.readFileSync(path.join(root, 'issues.js'), 'utf8');
  const outDir = path.join(root, 'pipeline', 'out', 'A');
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-06', dryRun: true, outputDir: outDir }));
  assert.equal(r.publishOk, true);
  assert.ok(r.published.issues >= 2, '이슈가 만들어져야 해요');
  assert.ok(r.published.news >= 1);
  assert.equal(fs.readFileSync(path.join(root, 'issues.js'), 'utf8'), before, '연습 실행은 저장소를 바꾸지 않아요');
  const payload = JSON.parse(fs.readFileSync(path.join(outDir, 'payload.json'), 'utf8'));
  assert.deepEqual(payload.issues.map((i) => i.id), payload.issues.map((_, k) => `2026-11-06-${k + 1}`));
  for (const i of payload.issues) assert.ok(i.sources.every((s) => /^https?:\/\//.test(s.url)));
  assert.ok(fs.existsSync(path.join(outDir, 'summary.md')));
  assert.match(fs.readFileSync(path.join(outDir, 'summary.md'), 'utf8'), /claude-sonnet-5-5/);
  assert.deepEqual(leaks(root), [], '기사 본문 표시가 저장소나 결과 폴더에서 발견되면 안 돼요');
  // 쓴 기사(used)와 본문 확인 실패가 아닌 후보만 쓰였는지: 이미 쓴 기사는 출처에 없다
  assert.ok(!JSON.stringify(payload).includes('99006'));
});

test('--mock (연습 아님): 복사본에 합쳐지고 check.mjs가 통과, 번호는 이어서', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', sampleCandidates('2026-11-06'));
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-06', dryRun: false }));
  assert.equal(r.changed, true);
  const W = loadWindow('issues.js', root).ISSUES;
  const mine = W.filter((i) => i.date === '2026-11-06');
  assert.equal(mine.length, r.published.issues);
  assert.deepEqual(mine.map((i) => i.id).sort(), mine.map((_, k) => `2026-11-06-${k + 1}`));
  const c = spawnSync(process.execPath, [path.join(root, 'scripts', 'check.mjs'), '--since', '2026-11-06'], { cwd: root, encoding: 'utf8' });
  assert.equal(c.status, 0, c.stdout);
  assert.match(c.stdout, /검사 통과/);
  assert.deepEqual(leaks(root), []);
});

test('같은 날 이슈가 이미 있으면 그 다음 번호부터 매긴다', async () => {
  const root = makeRepoCopy();
  // 2026-11-04에는 이미 이슈가 있다
  const existing = loadWindow('issues.js', root).ISSUES.filter((i) => i.date === '2026-11-04').length;
  assert.ok(existing >= 1);
  writeCandidates(root, '2026-11-04', sampleCandidates('2026-11-04'));
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-04', dryRun: true, outputDir: path.join(root, 'pipeline', 'out', 'B') }));
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'pipeline', 'out', 'B', 'payload.json'), 'utf8'));
  assert.equal(payload.issues[0].id, `2026-11-04-${existing + 1}`);
  assert.equal(r.publishOk, true);
});

test('일요일에는 주간 큰 그림도 만들어 합친다', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-08', sampleCandidates('2026-11-08'));
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-08', dryRun: true, outputDir: path.join(root, 'pipeline', 'out', 'C') }));
  assert.equal(r.published.weekly, 1);
  assert.equal(r.publishOk, true);
});

test('후보가 없으면 아무것도 바꾸지 않고 정상 종료', async () => {
  const root = makeRepoCopy();
  writeCandidates(root, '2026-11-06', []);
  const r = await quiet(() => runPipeline({ ...base, root, date: '2026-11-06', dryRun: false }));
  assert.equal(r.changed, false);
});

test('실제 저장소는 건드리지 않았다 (check --since 2026-11-05)', () => {
  const c = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'check.mjs'), '--since', '2026-11-05'], { encoding: 'utf8' });
  assert.equal(c.status, 0, c.stdout);
});
