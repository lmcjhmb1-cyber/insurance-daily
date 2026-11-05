// 올리기 단계: scripts/merge.mjs로 합치고 scripts/check.mjs로 검사해요. 실패하면 고치거나 빼고 처음 상태에서 다시 합쳐요.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TRACKED = ['issues.js', 'news.js', 'weekly.js', 'lessons.js', 'index.html', 'data'];

// 합치기 전 상태를 임시 폴더에 복사해 둬요 (git이 없는 복사본에서도 돌아가도록 git restore 대신 직접 되돌려요)
export function snapshot(root) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idaily-snap-'));
  for (const f of TRACKED) if (fs.existsSync(path.join(root, f))) fs.cpSync(path.join(root, f), path.join(dir, f), { recursive: true });
  return dir;
}
export function restore(root, snap) {
  for (const f of TRACKED) {
    fs.rmSync(path.join(root, f), { recursive: true, force: true });
    if (fs.existsSync(path.join(snap, f))) fs.cpSync(path.join(snap, f), path.join(root, f), { recursive: true });
  }
}

// 시험 합치기를 위한 저장소 복사본 (git, node_modules, 결과 폴더는 빼요)
export function copyRepo(root) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idaily-trial-'));
  fs.cpSync(root, dir, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(root, src).split(path.sep);
      return !(rel.includes('.git') || rel.includes('node_modules') || (rel[0] === 'pipeline' && rel[1] === 'out'));
    },
  });
  return dir;
}

function node(root, script, args) {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// 검사 출력의 [오류] 구역에서 문제가 난 id를 뽑아요 (줄 모양: 5칸 들여쓰기 + "id: 메시지")
export function parseCheckErrors(out) {
  const a = out.indexOf('[오류]');
  if (a < 0) return [];
  const rest = out.slice(a + 4);
  const end = rest.search(/\n\[(주의|요약)\]/);
  const block = end < 0 ? rest : rest.slice(0, end);
  return [...block.matchAll(/^ {5}(\S+?): (.*)$/gm)].map((m) => ({ id: m[1], msg: m[2] }));
}

export function writePayload(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
}

export function mergeAndCheck(root, payloadFile, date) {
  const m = node(root, 'merge.mjs', [payloadFile, '--bump']);
  if (m.code !== 0) return { ok: false, errors: [], out: m.out, stage: '합치기' };
  const c = node(root, 'check.mjs', ['--since', date]);
  return { ok: c.code === 0, errors: parseCheckErrors(c.out), out: m.out + c.out, stage: '검사' };
}

// repair(issue, messages) -> 고친 이슈 또는 null. 실패하면 문제 항목을 빼고 한 번 더. 끝까지 실패하면 ok:false.
export async function publish({ root, payload, date, payloadFile, repair, log = () => {} }) {
  const snap = snapshot(root);
  const removed = [];
  try {
    for (let round = 1; round <= 3; round++) {
      writePayload(payloadFile, payload);
      const r = mergeAndCheck(root, payloadFile, date);
      if (r.ok) { log(`  합치기와 검사 통과 (${round}번째 시도)`); return { ok: true, payload, removed, out: r.out }; }
      log(`  ${r.stage} 실패 (${round}번째 시도)`);
      const bad = new Set(r.errors.map((e) => e.id));
      const mine = (id) => payload.issues?.some((i) => i.id === id) || payload.news?.some((n) => n.id === id) || payload.weekly?.some((w) => w.id === id) || Object.hasOwn(payload.lessons || {}, id);
      if (![...bad].some(mine)) {
        log('  새 항목과 관련 없는 오류예요. 올리지 않아요.\n' + r.out.split('\n').filter((l) => /오류|^ {5}/.test(l)).slice(0, 12).join('\n'));
        restore(root, snap);
        return { ok: false, payload, removed, out: r.out };
      }
      restore(root, snap); // 깨끗한 상태에서 다시 합쳐요
      if (round === 1 && repair) {
        for (const i of payload.issues || []) {
          if (!bad.has(i.id)) continue;
          const msgs = r.errors.filter((e) => e.id === i.id).map((e) => e.msg);
          const fixed = await repair(i, msgs).catch((e) => { log(`  고치기 실패(${i.id}): ${e.message}`); return null; });
          if (fixed) payload.issues[payload.issues.indexOf(i)] = fixed;
        }
        continue;
      }
      // 고쳐도 안 되면 문제 항목을 빼요
      for (const id of bad) if (mine(id)) removed.push(id);
      const keepLessons = Object.fromEntries(Object.entries(payload.lessons || {}).filter(([k]) => !bad.has(k))); // 검사에서 걸린 용어는 빼요
      const dropIssue = new Set((payload.issues || []).filter((i) => bad.has(i.id)).map((i) => i.id));
      payload = {
        ...payload,
        issues: (payload.issues || []).filter((i) => !dropIssue.has(i.id)),
        news: (payload.news || []).filter((n) => !bad.has(n.id)).map((n) => (dropIssue.has(n.issue) ? (({ issue, ...rest }) => rest)(n) : n)),
        weekly: dropIssue.size ? [] : (payload.weekly || []).filter((w) => !bad.has(w.id)),
        lessons: keepLessons,
      };
      if (!payload.issues.length && !payload.news.length) break;
    }
    restore(root, snap);
    return { ok: false, payload, removed, out: '' };
  } finally {
    fs.rmSync(snap, { recursive: true, force: true });
  }
}
