// 후보 기사의 본문을 가져와 검증해요. 본문은 메모리에만 두고 저장소나 로그에 남기지 않아요(저작권).
import { normUrl } from '../scripts/_lib.mjs';
import { htmlToText, decodeEntities, pMap } from './util.mjs';

const UA = 'Mozilla/5.0 (compatible; insurance-daily-collector)';

export class FetchFail extends Error {
  constructor(reason, detail = '') { super(reason + (detail ? `: ${detail}` : '')); this.reason = reason; }
}

const normTitle = (s) => String(s || '').replace(/[^가-힣A-Za-z0-9]/g, '');

// 출처 사이트별 본문 위치. thin: 원래 짧은 자료(금감원 보도자료)
const RULES = [
  { host: /fsc\.go\.kr$/, re: /class="[^"]*content-body[^"]*"[^>]*>([\s\S]*?)<div class="[^"]*(?:board-btn|bbs-btn|btn)/, titleCheck: false, min: 200 },
  { host: /fss\.or\.kr$/, re: /class="[^"]*dbdata[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/, titleCheck: false, min: 80, thin: true },
  { host: /./, re: /id="article-view-content-div"[^>]*>([\s\S]*?)<\/article>/, titleCheck: true, min: 200 }, // 언론사(엔디소프트 기반)
];

export function ruleFor(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return RULES.find((r) => r.host.test(host));
}

// og:title이 후보 제목과 맞는지: 둘 다 글자·숫자만 남기고, 후보 제목 앞 12자가 들어 있어야 해요
export function titleMatches(html, candTitle) {
  // content="..." 안에 작은따옴표가 있어도 되도록 따옴표 종류별로 읽어요
  const tag = (html.match(/<meta[^>]+property=["']og:title["'][^>]*>/i) || [])[0];
  const m = tag && (tag.match(/content="([^"]*)"/i) || tag.match(/content='([^']*)'/i));
  if (!m) throw new FetchFail('no_og_title');
  const head = normTitle(candTitle).slice(0, 12);
  if (!head || !normTitle(decodeEntities(m[1])).includes(head)) throw new FetchFail('title_mismatch');
}

export function extractBody(html, cand) {
  const rule = ruleFor(cand.url);
  if (rule.titleCheck && cand.type !== 'regulator') titleMatches(html, cand.title);
  const m = html.match(rule.re);
  if (!m) throw new FetchFail('no_body');
  const text = htmlToText(m[1]);
  if (text.length < rule.min) throw new FetchFail('too_short', `${text.length}자`);
  return { text, thin: !!rule.thin };
}

async function getHtml(url, fetchImpl, timeoutMs) {
  let cur = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetchImpl(cur, {
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      redirect: 'manual', // 다른 기사로 넘기는 302를 걸러내려고 직접 따라가요
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new FetchFail('redirect_no_location');
      const next = new URL(loc, cur).href;
      if (normUrl(next) !== normUrl(url)) throw new FetchFail('redirect_other', '다른 주소로 넘어가요');
      cur = next; // http에서 https로 같은 기사로 가는 경우만 따라가요
      continue;
    }
    if (!res.ok) throw new FetchFail('http_' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    const head = (res.headers.get('content-type') || '') + ' ' + buf.subarray(0, 600).toString('latin1');
    const cs = (head.match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try {
      return new TextDecoder(cs).decode(buf);
    } catch {
      return buf.toString('utf8');
    }
  }
  throw new FetchFail('too_many_redirects');
}

// 한 건 가져오기: 실패하면 한 번 더 (다른 기사 리디렉션과 제목 불일치는 다시 해도 소용없어요)
export async function fetchArticle(cand, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const html = await getHtml(cand.url, fetchImpl, timeoutMs);
      return { ok: true, ...extractBody(html, cand) };
    } catch (e) {
      last = e instanceof FetchFail ? e : new FetchFail(e.name === 'TimeoutError' ? 'timeout' : 'network', e.message);
      if (['redirect_other', 'title_mismatch', 'no_og_title', 'no_body', 'too_short'].includes(last.reason)) break;
    }
  }
  return { ok: false, reason: last.reason, detail: last.message };
}

// 동시 4개. 돌려주는 bodies는 메모리 안의 Map이에요.
export async function fetchAll(cands, { concurrency = 4, fetchImpl, timeoutMs, log = () => {} } = {}) {
  const bodies = new Map();
  const failures = [];
  await pMap(cands, concurrency, async (c) => {
    const r = await fetchArticle(c, { fetchImpl, timeoutMs });
    if (r.ok) bodies.set(c.id, { text: r.text, thin: r.thin });
    else failures.push({ id: c.id, title: c.title, reason: r.reason });
  });
  const lens = [...bodies.values()].map((b) => b.text.length);
  log(`  본문 확인: 성공 ${bodies.size}건, 실패 ${failures.length}건` + (lens.length ? ` (글자 수 ${Math.min(...lens)}~${Math.max(...lens)})` : ''));
  for (const f of failures) log(`    실패 ${f.id}: ${f.reason}`);
  return { bodies, failures };
}
