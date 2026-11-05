// 후보 기사의 본문을 가져와 검증해요. 본문은 메모리에만 두고 저장소나 로그에 남기지 않아요(저작권).
import { normUrl } from '../scripts/_lib.mjs';
import { htmlToText, decodeEntities, pMap } from './util.mjs';

const UA = 'Mozilla/5.0 (compatible; insurance-daily-collector)';

export class FetchFail extends Error {
  constructor(reason, detail = '') { super(reason + (detail ? `: ${detail}` : '')); this.reason = reason; }
}

const normTitle = (s) => String(s || '').replace(/[^가-힣A-Za-z0-9]/g, '');

// 금융위, 금감원은 전용 규칙. thin: 원래 짧은 자료(금감원 보도자료)
const RULES = [
  { host: /fsc\.go\.kr$/, re: /class="[^"]*content-body[^"]*"[^>]*>([\s\S]*?)<div class="[^"]*(?:board-btn|bbs-btn|btn)/, titleCheck: false, min: 200 },
  { host: /fss\.or\.kr$/, re: /class="[^"]*dbdata[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/, titleCheck: false, min: 80, thin: true },
];
const GENERIC_MIN = 200;

// 언론사 본문 컨테이너의 id/class 이름. 앞쪽일수록 먼저 시도해요(더 구체적인 것부터).
export const BODY_CONTAINERS = [
  'article-view-content-div', 'article-body-content', 'articleBody', 'article_body', 'articeBody', 'article-body', 'newsct_article', 'dic_area',
  'news_body_area', 'newsEndContents', 'art_body', 'articletxt', 'article-text', 'article_txt', 'news_content',
  'detail_editor', 'cont_view', 'view_cont', 'view_con', 'news_view',
];

export function ruleFor(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return RULES.find((r) => r.host.test(host)) || null;
}

// ---------- 메타 태그와 제목 ----------
function metaContent(html, prop) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const p = tag.match(/(?:property|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/i) || [];
    if ((p[1] ?? p[2] ?? '').toLowerCase() !== prop) continue;
    // content="..." 안에 작은따옴표가 있어도 되도록 따옴표 종류별로 읽어요
    const m = tag.match(/content\s*=\s*"([^"]*)"/i) || tag.match(/content\s*=\s*'([^']*)'/i);
    if (m) return decodeEntities(m[1]);
  }
  return '';
}

// 페이지 제목: og:title, 없으면 <title>
function pageTitle(html) {
  return metaContent(html, 'og:title') || decodeEntities(((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim());
}

// 제목 앞의 [단독], (종합) 같은 말머리를 떼요
export function stripPrefix(title) {
  let t = String(title || '').trim();
  for (let i = 0; i < 4; i++) {
    const next = t.replace(/^(?:\[[^\]]*\]|【[^】]*】|\([^)]*\)|〈[^〉]*〉|<[^>]*>)\s*/, '');
    if (next === t) break;
    t = next;
  }
  return t;
}

// 페이지 제목이 후보 제목과 맞는지: 글자·숫자만 남기고, 후보 제목 앞 12자(말머리를 뗀 앞 12자도)가 들어 있어야 해요
export function titleMatches(html, candTitle) {
  const page = pageTitle(html);
  if (!page) throw new FetchFail('no_title');
  const heads = [normTitle(candTitle).slice(0, 12), normTitle(stripPrefix(candTitle)).slice(0, 12)].filter(Boolean);
  const hay = normTitle(page);
  if (!heads.some((h) => hay.includes(h))) throw new FetchFail('title_mismatch');
}

// og:site_name을 짧게 정리 (프롬프트와 출처 표기에 들어가니 따옴표와 꺾쇠는 빼요)
export function siteNameOf(html) {
  return metaContent(html, 'og:site_name').replace(/[<>"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
}

// ---------- 본문 찾기 ----------
// openIdx에서 시작하는 <tag ...> 와 짝이 맞는 닫는 태그까지의 안쪽 html
function balancedInner(html, openIdx, tag) {
  const open = html.indexOf('>', openIdx);
  if (open < 0) return null;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = open + 1;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(open + 1, m.index);
  }
  return null;
}

const cleanHtml = (html) => html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|iframe|nav|aside|form|button)\b[\s\S]*?<\/\1>/gi, ' ');

function findDeep(o, key, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 6) return null;
  if (typeof o[key] === 'string') return o[key];
  for (const v of Array.isArray(o) ? o : Object.values(o)) { const r = findDeep(v, key, depth + 1); if (r) return r; }
  return null;
}

function fromJsonLd(html, ok) {
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const body = findDeep(data, 'articleBody');
    if (body) { const t = htmlToText(body); if (ok(t)) return t; }
  }
  return '';
}

function fromContainers(clean, ok) {
  const tokensOf = (attrs) => {
    const s = new Set();
    for (const a of ['id', 'class', 'itemprop']) {
      const m = attrs.match(new RegExp(`\\b${a}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
      for (const t of ((m && (m[1] ?? m[2])) || '').split(/\s+/)) if (t) s.add(t.toLowerCase());
    }
    return s;
  };
  const info = [...clean.matchAll(/<(div|article|section|span|td|main)\b([^>]*)>/gi)].map((m) => ({ m, tokens: tokensOf(m[2]) }));
  for (const name of BODY_CONTAINERS) {
    for (const { m, tokens } of info) {
      if (!tokens.has(name.toLowerCase())) continue;
      const inner = balancedInner(clean, m.index, m[1]);
      if (!inner) continue;
      const t = htmlToText(inner);
      if (ok(t)) return t;
    }
  }
  return '';
}

function fromArticleTag(clean, ok) {
  for (const m of clean.matchAll(/<article\b/gi)) {
    const inner = balancedInner(clean, m.index, 'article');
    const t = inner ? htmlToText(inner) : '';
    if (ok(t)) return t;
  }
  return '';
}

function fromParagraphs(clean, ok) {
  const ps = [...clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => htmlToText(m[1])).filter((t) => t.length >= 40);
  const t = ps.join('\n');
  return ok(t) ? t : '';
}

// 일반 언론사: JSON-LD → 알려진 컨테이너 → <article> → 긴 <p> 문단 순서로 시도
// 200자 이상인 것을 못 찾으면 가장 긴 후보를 돌려줘서 "너무 짧음"과 "본문 없음"을 구분해요
export function genericBody(html) {
  let best = '';
  const ok = (t) => { if (t.length > best.length) best = t; return t.length >= GENERIC_MIN; };
  const ld = fromJsonLd(html, ok);
  if (ld) return ld;
  const clean = cleanHtml(html);
  return fromContainers(clean, ok) || fromArticleTag(clean, ok) || fromParagraphs(clean, ok) || best;
}

export function extractBody(html, cand) {
  const rule = ruleFor(cand.url);
  const siteName = siteNameOf(html);
  if (rule) {
    if (rule.titleCheck && cand.type !== 'regulator') titleMatches(html, cand.title);
    const m = html.match(rule.re);
    if (!m) throw new FetchFail('no_body');
    const text = htmlToText(m[1]);
    if (text.length < rule.min) throw new FetchFail('too_short', `${text.length}자`);
    return { text, thin: !!rule.thin, siteName };
  }
  if (cand.type !== 'regulator') titleMatches(html, cand.title); // 엉뚱한 기사를 200으로 주는 언론사가 있어서 꼭 확인해요
  const text = genericBody(html);
  if (!text) throw new FetchFail('no_body');
  if (text.length < GENERIC_MIN) throw new FetchFail('too_short', `${text.length}자`);
  return { text, thin: false, siteName };
}

// ---------- 가져오기 ----------
const hostKey = (h) => h.toLowerCase().replace(/^(?:www|m)\./, '');
// 프로토콜과 호스트 앞의 www., m. 차이만 있는 같은 경로·쿼리인지
export function sameArticle(a, b) {
  try {
    if (normUrl(a) === normUrl(b)) return true;
    const x = new URL(a), y = new URL(b);
    const p = (u) => u.pathname.replace(/\/+$/, '');
    return hostKey(x.hostname) === hostKey(y.hostname) && p(x) === p(y) && x.search === y.search;
  } catch { return false; }
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
      if (!sameArticle(next, url)) throw new FetchFail('redirect_other', '다른 주소로 넘어가요');
      cur = next; // 프로토콜이나 www., m. 차이만 있는 같은 기사로 가는 경우만 따라가요
      continue;
    }
    if (!res.ok) throw new FetchFail('http_' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    const head = (res.headers.get('content-type') || '') + ' ' + buf.subarray(0, 4096).toString('latin1');
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
      if (['redirect_other', 'title_mismatch', 'no_title', 'no_body', 'too_short'].includes(last.reason)) break;
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
    if (r.ok) bodies.set(c.id, { text: r.text, thin: r.thin, siteName: r.siteName || '' });
    else failures.push({ id: c.id, title: c.title, reason: r.reason });
  });
  const lens = [...bodies.values()].map((b) => b.text.length);
  log(`  본문 확인: 성공 ${bodies.size}건, 실패 ${failures.length}건` + (lens.length ? ` (글자 수 ${Math.min(...lens)}~${Math.max(...lens)})` : ''));
  for (const f of failures) log(`    실패 ${f.id}: ${f.reason}`);
  return { bodies, failures };
}

// 네이버 뉴스로 모은 후보는 출처 이름을 실제 언론사 이름(og:site_name, 없으면 호스트)으로 바꿔요
export function withRealSources(cands, bodies) {
  return cands.map((c) => {
    if (c.source !== '네이버 뉴스') return c;
    let name = bodies.get(c.id)?.siteName || '';
    if (!name || name.includes('네이버')) name = new URL(c.url).hostname.replace(/^(?:www|m)\./, '');
    return { ...c, source: name };
  });
}
