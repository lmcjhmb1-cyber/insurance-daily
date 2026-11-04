// 이슈·용어 학습·회사 정보를 화면이 필요한 만큼만 불러오도록 data/ 폴더에 나눠 만들어요.
// 사용법: node scripts/build-data.mjs [--check]
//   data/ 안의 파일은 이 스크립트가 만드는 파일이에요. 손으로 고치지 마세요(원본은 issues.js, lessons.js, profiles.js).
//   --check 를 주면 파일을 쓰지 않고, data/가 원본과 다르면 종료 코드 1로 끝나요.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ROOT, loadWindow } from './_lib.mjs';

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const J = (v) => JSON.stringify(v);

// 화면이 이슈를 열기 전에 쓰는 가벼운 항목만 뽑아요 (app.js의 coOf와 같은 규칙으로 회사도 미리 찾아둬요)
function slimOf(it, companies) {
  const o = { id: it.id, date: it.date, tag: it.tag, title: it.title };
  if (it.thread) o.thread = it.thread;
  if (it.companies) o.companies = it.companies;
  if (it.jobs) o.jobs = it.jobs;
  if (it.basic) o.basic = it.basic;
  if (it.summary) o.summary = it.summary;
  const txt = [it.title, ...(it.points || []), it.why, it.summary].join(' ').replace(/\*\*/g, '');
  const set = new Set(it.companies || []);
  for (const c of companies) if ([c.name, ...(c.aka || [])].some((n) => txt.includes(n))) set.add(c.name);
  const co = companies.map((c) => c.name).filter((n) => set.has(n));
  if (co.length) o.co = co;
  if (it.points && it.points[0]) o.p0 = it.points[0];
  if (it.interview) o.hi = 1;
  if (it.terms && it.terms.length) o.tn = it.terms.map((x) => x.t);
  return o;
}

// 만들 파일 전체를 {경로: 내용}으로 돌려줘요 (쓰지는 않아요)
export function buildData(root = ROOT) {
  const files = new Map();
  const issues = loadWindow('issues.js', root).ISSUES || [];
  const lessons = loadWindow('lessons.js', root).LESSONS || {};
  const profiles = loadWindow('profiles.js', root).PROFILES || {};
  let companies = [];
  try { companies = loadWindow('companies.js', root).COMPANIES || []; } catch (e) { /* 없으면 회사 찾기만 건너뛰어요 */ }

  const byDate = new Map();
  for (const it of issues) {
    if (!byDate.has(it.date)) byDate.set(it.date, []);
    byDate.get(it.date).push(it);
  }
  const detailH = {};
  for (const d of [...byDate.keys()].sort()) {
    const text = `window.__detail(${J(d)},${J(byDate.get(d))});\n`;
    files.set(`data/d/${d}.js`, text);
    detailH[d] = sha(text);
  }
  const lazy = (name, obj) => `window.__lazy(${J(name)},${J(obj)});\n`;
  const lText = lazy('lessons', lessons), pText = lazy('profiles', profiles);
  files.set('data/lessons.js', lText);
  files.set('data/profiles.js', pText);

  // 용어 사전: 용어마다 첫 뜻과 쓰인 이슈 아이디 (정렬은 app.js가 해요)
  const gl = new Map();
  for (const it of issues) for (const x of it.terms || []) {
    if (!gl.has(x.t)) gl.set(x.t, [x.t, x.d, []]);
    gl.get(x.t)[2].push(it.id);
  }
  const index = [
    '// 자동으로 만든 파일이에요. 손으로 고치지 마세요. 원본은 issues.js, lessons.js, profiles.js이고 node scripts/build-data.mjs로 다시 만들어요.',
    `window.ISSUES=${J(issues.map((it) => slimOf(it, companies)))};`,
    `window.GLOSS_DATA=${J([...gl.values()])};`,
    `window.DETAIL_H=${J(detailH)};`,
    `window.LESSON_KEYS=${J(Object.keys(lessons))};`,
    `window.PROFILE_KEYS=${J(Object.keys(profiles))};`,
    `window.LAZY_H=${J({ lessons: sha(lText), profiles: sha(pText) })};`,
    '',
  ].join('\n');
  files.set('data/index.js', index);
  return files;
}

const norm = (s) => s.replace(/\r\n/g, '\n');
function listOld(root) {
  const out = [];
  const walk = (rel) => {
    const dir = path.join(root, rel);
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel + '/' + f.name;
      if (f.isDirectory()) walk(r); else out.push(r);
    }
  };
  walk('data');
  return out;
}

// data/를 원본과 맞춰요. check가 true면 쓰지 않고 다른 파일 목록만 돌려줘요.
export function syncData({ root = ROOT, check = false } = {}) {
  const files = buildData(root);
  const stale = [];
  for (const [rel, text] of files) {
    const p = path.join(root, rel);
    const cur = fs.existsSync(p) ? norm(fs.readFileSync(p, 'utf8')) : null;
    if (cur !== text) {
      stale.push(rel);
      if (!check) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); }
    }
  }
  for (const rel of listOld(root)) {
    if (!files.has(rel)) {
      stale.push(rel + ' (지워야 해요)');
      if (!check) fs.unlinkSync(path.join(root, rel));
    }
  }
  return { files, stale };
}

const kb = (n) => (n / 1024).toFixed(1) + 'KB';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { files, stale } = syncData({ check });
  if (check) {
    if (stale.length) {
      console.error(`data/가 원본보다 오래됐어요. node scripts/build-data.mjs를 실행해 다시 만드세요. (${stale.length}개)`);
      stale.slice(0, 20).forEach((s) => console.error('  ' + s));
      if (stale.length > 20) console.error(`  ... 외 ${stale.length - 20}개`);
      process.exit(1);
    }
    console.log('data/가 원본과 같아요.');
  } else {
    const size = (k) => Buffer.byteLength(files.get(k));
    const days = [...files.keys()].filter((k) => k.startsWith('data/d/'));
    const dsz = days.reduce((s, k) => s + size(k), 0);
    console.log(`data/index.js ${kb(size('data/index.js'))} (처음 한 번 받는 목록)`);
    console.log(`data/d/ 날짜별 ${days.length}개, 합계 ${kb(dsz)} (이슈를 열 때 그 날짜만 받아요)`);
    console.log(`data/lessons.js ${kb(size('data/lessons.js'))}, data/profiles.js ${kb(size('data/profiles.js'))} (필요한 화면에서만 받아요)`);
    console.log(stale.length ? `바뀐 파일 ${stale.length}개` : '바뀐 파일이 없어요.');
  }
}
