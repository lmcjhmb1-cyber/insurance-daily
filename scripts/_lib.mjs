// 스크립트 공용 도구: 저장소 경로, 데이터 파일 읽기, 한국 시간, 주소 정리
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// window.X = ... 형태의 데이터 파일을 읽어 window 객체를 돌려줘요
export function loadWindow(file, root = ROOT) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  return ctx.window;
}

// 한국 시간(UTC+9) 기준 날짜 조각
export function kstNow(now = new Date()) {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return {
    date: `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}`,
    time: `${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`,
    stamp: `${k.getUTCFullYear()}${p(k.getUTCMonth() + 1)}${p(k.getUTCDate())}${p(k.getUTCHours())}${p(k.getUTCMinutes())}`,
    iso: `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}T${p(k.getUTCHours())}:${p(k.getUTCMinutes())}:${p(k.getUTCSeconds())}+09:00`,
  };
}

export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 기사 주소 비교용으로 정리: 프로토콜, www, 끝 슬래시 제거. 엔디소프트 기사는 idxno로 비교
export function normUrl(u) {
  if (!u) return '';
  let s = String(u).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const m = s.match(/^([^/?#]+).*[?&]idxno=(\d+)/i);
  if (m) return m[1].toLowerCase().replace(/^www\./, '') + '#idxno=' + m[2];
  const nt = s.match(/^([^/?#]+).*[?&]nttId=(\d+)/i);
  if (nt) return nt[1].toLowerCase() + '#nttId=' + nt[2];
  s = s.replace(/#.*$/, '').replace(/\/+$/, '');
  const i = s.indexOf('/');
  return i < 0 ? s.toLowerCase() : s.slice(0, i).toLowerCase() + s.slice(i);
}
