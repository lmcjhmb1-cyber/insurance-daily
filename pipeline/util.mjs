// 파이프라인 공용 도구: 로그, 동시 실행, HTML 글자 다루기
export const log = (...a) => console.log(...a);
export const warn = (...a) => console.warn(...a);

// 동시에 n개씩 처리하고 결과는 입력 순서대로 돌려줘요
export async function pMap(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  return out;
}

const ENT = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
export function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

// 본문 HTML을 줄바꿈이 있는 글자로 바꿔요
export function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/\r\n?/g, '\n')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\p{Cf}/gu, '') // 보이지 않는 글자(너비 없는 공백 등)
    .replace(/[\t\p{Zs}]+/gu, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const clip = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
export const money = (n) => '$' + n.toFixed(n < 1 ? 4 : 2);

// 날짜 문자열의 요일 (0=일요일)
export const weekday = (date) => new Date(date + 'T00:00:00Z').getUTCDay();
