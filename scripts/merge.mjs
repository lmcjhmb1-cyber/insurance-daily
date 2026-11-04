// 새 내용을 이슈, 회사 소식, 주간 정리 파일에 합쳐 넣어요.
// 사용법: node scripts/merge.mjs 새내용.json [--bump]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadWindow, kstNow, normUrl } from './_lib.mjs';
import { syncData } from './build-data.mjs';

const args = process.argv.slice(2);
const bump = args.includes('--bump');
const rootArg = args.find((a) => a.startsWith('--root='));
const root = rootArg ? path.resolve(rootArg.slice(7)) : ROOT; // 시험용: 다른 저장소 복사본
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('사용법: node scripts/merge.mjs 새내용.json [--bump]');
  process.exit(2);
}
let input;
try {
  input = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
} catch (e) {
  console.error('새 내용 파일을 읽지 못했어요: ' + e.message);
  process.exit(2);
}

// 아이디 끝 번호: 기초 이슈(b번호)는 같은 날 일반 이슈 뒤로
const idKey = (id) => {
  const m = String(id).match(/-(b?)(\d+)$/);
  return m ? { b: m[1] ? 1 : 0, n: Number(m[2]) } : { b: 0, n: 0 };
};
const cmpDateIdn = (a, b) => {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const x = idKey(a.id), y = idKey(b.id);
  return x.b - y.b || x.n - y.n;
};

const TARGETS = [
  { key: 'issues', file: 'issues.js', global: 'ISSUES', sort: cmpDateIdn, label: '이슈' },
  { key: 'news', file: 'news.js', global: 'NEWS', sort: cmpDateIdn, label: '회사 소식', byUrl: (n) => n.source && n.source.url },
  { key: 'weekly', file: 'weekly.js', global: 'WEEKLY', sort: (a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0), label: '주간 정리' },
];

for (const t of TARGETS) {
  const p = path.join(root, t.file);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  const text = raw.replace(/\r\n/g, '\n');
  const marker = `window.${t.global} = `;
  const at = text.indexOf('\n' + marker) >= 0 ? text.indexOf('\n' + marker) + 1 : text.indexOf(marker);
  if (at < 0) { console.error(`${t.file}: ${marker}를 찾지 못했어요.`); process.exit(1); }
  const head = text.slice(0, at); // 맨 위 주석 그대로
  const cur = loadWindow(t.file, root)[t.global];
  const add = Array.isArray(input[t.key]) ? input[t.key] : [];
  const ids = new Set(cur.map((x) => x.id));
  const urls = new Set(t.byUrl ? cur.map((x) => normUrl(t.byUrl(x))).filter(Boolean) : []);
  const skipped = [];
  let added = 0;
  for (const it of add) {
    const u = t.byUrl ? normUrl(t.byUrl(it)) : '';
    if (!it || !it.id) { skipped.push('(아이디 없음)'); continue; }
    if (ids.has(it.id)) { skipped.push(`${it.id} (같은 아이디)`); continue; }
    if (u && urls.has(u)) { skipped.push(`${it.id} (같은 기사 주소)`); continue; }
    ids.add(it.id); if (u) urls.add(u);
    cur.push(it); added++;
  }
  cur.sort(t.sort); // 안정 정렬
  let out = head + marker + JSON.stringify(cur, null, 2) + ';\n';
  if (crlf) out = out.replace(/\n/g, '\r\n');
  if (out !== raw) fs.writeFileSync(p, out);
  console.log(`${t.label}(${t.file}): 추가 ${added}건, 건너뜀 ${skipped.length}건${out !== raw ? ' [파일 바뀜]' : ''}`);
  skipped.forEach((s) => console.log('  건너뜀: ' + s));
}

// 이슈가 바뀌었을 수 있으니 data/ 폴더도 새로 만들어요 (화면은 data/를 읽어요)
{
  const { stale } = syncData({ root });
  console.log(stale.length ? `data/ 폴더를 새로 만들었어요 (바뀐 파일 ${stale.length}개).` : 'data/ 폴더는 이미 최신이에요.');
}

if (bump) {
  const p = path.join(root, 'index.html');
  const raw = fs.readFileSync(p, 'utf8');
  const v = kstNow().stamp;
  let n = 0;
  const out = raw.replace(/\?v=\d{12}/g, () => { n++; return '?v=' + v; });
  if (out !== raw) fs.writeFileSync(p, out);
  console.log(`index.html 버전 숫자 ${n}곳을 ${v}로 바꿨어요.`);
}
