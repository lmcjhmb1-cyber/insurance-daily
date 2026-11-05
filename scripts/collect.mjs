// 매일 아침 어제의 보험 기사 후보를 모아 candidates/날짜.json 으로 저장해요.
// 사용법: node scripts/collect.mjs [YYYY-MM-DD]   (날짜 생략하면 한국 시간 기준 어제)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadWindow, kstNow, addDays, normUrl } from './_lib.mjs';

const UA = 'Mozilla/5.0 (compatible; insurance-daily-collector)';
const argDate = process.argv[2];
if (argDate && !/^\d{4}-\d{2}-\d{2}$/.test(argDate)) {
  console.error('날짜는 YYYY-MM-DD 모양으로 써주세요.');
  process.exit(2);
}
const now = kstNow();
const D = argDate || addDays(now.date, -1);
const D2 = addDays(D, 1);
const inRange = (d) => d === D || d === D2;

// ---------- 글자 다루기 ----------
const ENT = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] ?? m));
}
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const stripTags = (s) => squash(decode(String(s).replace(/<[^>]*>/g, ' ')));

// ---------- 가져오기 ----------
async function get(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*', 'Accept-Language': 'ko-KR,ko;q=0.9' },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get('content-type') || '') + ' ' + buf.subarray(0, 600).toString('latin1');
  const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1] || (/encoding=["']euc-kr/i.test(ct) ? 'euc-kr' : 'utf-8');
  try {
    return new TextDecoder(cs).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

// ---------- 보험 키워드, 회사 ----------
const KEYWORDS = ['보험', '생보', '손보', '생명', '화재', '손해', '실손', '계리', '킥스', 'K-ICS', '지급여력', 'IFRS17', '보험계약마진', 'CSM', '설계사', 'GA', '법인보험대리점', '방카', '보험금', '보험료', '손해율', '재보험', '퇴직연금', '연금보험', '보험사기', '공제'];
// 뜻이 넓은 말은 혼자서는 보험 기사라고 보지 않아요 (점수에는 들어가요)
const WEAK = new Set(['생명', '화재', '손해', '공제', 'GA']);
const kwRe = (k) => (/^[A-Za-z0-9-]+$/.test(k) ? new RegExp('(?<![A-Za-z0-9])' + k + '(?![A-Za-z0-9])', 'i') : new RegExp(k));
const KW = KEYWORDS.map((k) => ({ k, re: kwRe(k), weak: WEAK.has(k) }));
const hits = (text) => KW.filter((x) => x.re.test(text));

const comp = loadWindow('companies.js').COMPANIES;
// 짧은 이름 표: 회사 정식 이름 -> 기사에서 쓰는 다른 표현 (두 글자 이름은 오탐이 많아 쓰지 않아요)
const EXTRA = { 메리츠화재: ['메리츠(?!증권|캐피탈|금융)'], 현대해상: ['현대해상화재'], 삼성화재: ['삼성화재해상'], NH농협생명: ['NH생명'], 'NH농협손해보험': ['NH손보'] };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compRes = comp.map((c) => {
  const pats = [c.name, ...(c.aka || [])].map(esc).concat(EXTRA[c.name] || []);
  return { name: c.name, re: new RegExp(pats.join('|')) };
});
const tagCompanies = (text) => compRes.filter((c) => c.re.test(text)).map((c) => c.name);

// ---------- 이미 쓴 기사 주소 ----------
const used = new Set();
try {
  for (const i of loadWindow('issues.js').ISSUES || []) for (const s of i.sources || []) used.add(normUrl(s.url));
  for (const n of loadWindow('news.js').NEWS || []) if (n.source) used.add(normUrl(n.source.url));
} catch (e) {
  console.warn('이슈, 회사 소식 파일을 읽지 못해 사용 표시를 건너뛰어요: ' + e.message);
}

// ---------- 출처별 수집 ----------
async function fscPage(page) {
  const url = 'https://www.fsc.go.kr/no010101' + (page > 1 ? `?curPage=${page}` : '');
  const html = await get(url);
  const parts = html.split('<div class="subject">').slice(1);
  const out = [];
  for (const part of parts) {
    const a = part.match(/<a href="(\/no010101\/\d+)[^"]*"\s+title="([^"]*)"/);
    if (!a) continue;
    const day = (part.match(/<div class="day">\s*(\d{4}-\d{2}-\d{2})/) || [])[1];
    const dept = (part.match(/담당부서\s*:\s*([^<]*)</) || [])[1];
    // 첨부 가운데 pdf 링크
    let pdf;
    for (const m of part.matchAll(/<a href="(\/comm\/getFile[^"]*)"\s+title="([^"]*)"/g)) {
      if (/\.pdf$/i.test(m[2].trim())) { pdf = 'https://www.fsc.go.kr' + decode(m[1]); break; }
    }
    out.push({ title: squash(decode(a[2])), url: 'https://www.fsc.go.kr' + a[1], date: day, dept: dept ? squash(decode(dept)) : undefined, pdf });
  }
  return out;
}
async function fssPage(page) {
  const url = 'https://www.fss.or.kr/fss/bbs/B0000188/list.do?menuNo=200218' + (page > 1 ? `&pageIndex=${page}` : '');
  const html = await get(url);
  const parts = html.split('<td class="title">').slice(1);
  const out = [];
  for (const part of parts) {
    const a = part.match(/<a href="[^"]*nttId=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const rest = part.slice(a.index + a[0].length);
    const dept = (rest.match(/<td>\s*([^<]*?)\s*<\/td>/) || [])[1];
    const day = (rest.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
    out.push({ title: squash(decode(a[2].replace(/<[^>]*>/g, ''))), url: `https://www.fss.or.kr/fss/bbs/B0000188/view.do?nttId=${a[1]}&menuNo=200218`, date: day, dept: dept ? squash(decode(dept)) : undefined });
  }
  return out;
}

// RFC-822 또는 "YYYY-MM-DD HH:mm:ss"(한국 시간) 모두 받아요
function parsePub(s) {
  s = squash(s);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
  const t = new Date(s);
  if (isNaN(t)) return null;
  const k = kstNow(t);
  return { date: k.date, time: k.time };
}
function parseRss(xml, name) {
  const out = [];
  for (const it of xml.split(/<item[\s>]/i).slice(1)) {
    const tag = (n) => {
      const m = it.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, 'i'));
      if (!m) return '';
      const c = m[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      return c ? c[1] : decode(m[1]);
    };
    const title = squash(decode(tag('title').replace(/<[^>]*>/g, ' ')));
    const link = squash(tag('link'));
    const pub = parsePub(tag('pubDate'));
    if (!title || !link || !pub) continue;
    const summary = stripTags(tag('description')).slice(0, 300);
    out.push({ title, url: link, date: pub.date, time: pub.time, summary: summary || undefined, author: squash(decode(tag('author'))) || undefined, source: name });
  }
  return out;
}

const SOURCES = [
  { name: '금융위원회', url: 'https://www.fsc.go.kr/no010101', type: 'regulator', run: async () => [...(await fscPage(1)), ...(await fscPage(2))] },
  { name: '금감원', url: 'https://www.fss.or.kr/fss/bbs/B0000188/list.do?menuNo=200218', type: 'regulator', run: async () => [...(await fssPage(1)), ...(await fssPage(2))] },
  ...[
    ['한국보험신문', 'https://www.insnews.co.kr/rss/allArticle.xml', false],
    ['보험저널', 'https://www.insjournal.co.kr/rss/allArticle.xml', false],
    ['보험매일', 'https://www.insweek.co.kr/rss/allArticle.xml', false],
    ['대한금융신문', 'https://www.kbanker.co.kr/rss/allArticle.xml', true],
  ].map(([name, url, general]) => ({ name, url, type: 'press', general, run: async () => parseRss(await get(url), name) })),
];

// ---------- 네이버 뉴스 (키가 있을 때만) ----------
// 새 API HUB 주소를 먼저 쓰고, 예전 개발자센터 키면 예전 주소로 받아요.
const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;
const NAVER_ENDPOINTS = [
  { url: 'https://naverapihub.apigw.ntruss.com/search/v1/news', headers: { 'X-NCP-APIGW-API-KEY-ID': NAVER_ID, 'X-NCP-APIGW-API-KEY': NAVER_SECRET } },
  { url: 'https://openapi.naver.com/v1/search/news.json', headers: { 'X-Naver-Client-Id': NAVER_ID, 'X-Naver-Client-Secret': NAVER_SECRET } },
];
let naverEp = null;
async function naverQuery(query, display) {
  const eps = naverEp ? [naverEp] : NAVER_ENDPOINTS;
  let last = '';
  for (const ep of eps) {
    const res = await fetch(`${ep.url}?query=${encodeURIComponent(query)}&display=${display}&sort=date`, { headers: ep.headers, signal: AbortSignal.timeout(20000) });
    if (res.ok) { naverEp = ep; return (await res.json()).items || []; }
    last = 'HTTP ' + res.status;
  }
  throw new Error(last);
}
async function naverRun() {
  const queries = [['보험', 100], ['생명보험', 100], ['손해보험', 100], ['보험사', 100], ['보험업', 50], ...comp.map((c) => [c.name, 30])];
  const out = [];
  let okCount = 0, lastErr = '';
  for (const [q, n] of queries) {
    try {
      for (const it of await naverQuery(q, n)) {
        const pub = parsePub(it.pubDate || '');
        const title = stripTags(it.title || '');
        const url = it.originallink || it.link;
        if (pub && title && url) out.push({ title, url, date: pub.date, time: pub.time, summary: stripTags(it.description || '').slice(0, 300) || undefined });
      }
      okCount++;
    } catch (e) { lastErr = e.message; }
  }
  if (!okCount) throw new Error('모든 검색 실패: ' + lastErr);
  return out;
}
if (NAVER_ID && NAVER_SECRET) SOURCES.push({ name: '네이버 뉴스', url: 'https://naverapihub.apigw.ntruss.com/search/v1/news', type: 'press', general: true, strict: true, run: naverRun });
else console.log('네이버 키가 없어서 네이버 뉴스는 건너뛰어요.');

// ---------- 묶기 ----------
const normTitle = (t) => t.replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/[^0-9A-Za-z가-힣]/g, '');
const bigrams = (s) => { const r = new Set(); for (let i = 0; i < s.length - 1; i++) r.add(s.slice(i, i + 2)); return r; };
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n);
}

async function main() {
  console.log(`기사 후보 모으기: 기준 날짜 ${D} (다음 날 ${D2}까지 포함)`);
  const sources = [];
  const errors = [];
  let raw = [];
  await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const list = await s.run();
        const rec = { name: s.name, url: s.url, count: 0, ok: true, _list: list };
        sources.push(rec);
        for (const it of list) raw.push({ ...it, source: s.name, type: s.type, general: !!s.general, strict: !!s.strict });
      } catch (e) {
        const msg = (e && e.cause && e.cause.code) || (e && e.message) || String(e);
        sources.push({ name: s.name, url: s.url, count: 0, ok: false });
        errors.push(`${s.name}: ${msg}`);
      }
    })
  );
  // 출처 순서를 정의된 순서로
  sources.sort((a, b) => SOURCES.findIndex((x) => x.name === a.name) - SOURCES.findIndex((x) => x.name === b.name));

  // 같은 기사는 전문지와 당국 출처를 네이버보다 먼저 남겨요
  raw.sort((a, b) => a.strict - b.strict);
  // 날짜 거르기, 주소 중복 없애기
  const byUrl = new Map();
  for (const it of raw) {
    if (!it.date || !inRange(it.date)) continue;
    const key = normUrl(it.url);
    const old = byUrl.get(key);
    if (!old) byUrl.set(key, it);
    else for (const k of ['pdf', 'dept', 'summary']) if (!old[k] && it[k]) old[k] = it[k];
  }

  const items = [];
  for (const it of byUrl.values()) {
    const text = it.title + ' ' + (it.summary || '');
    const kw = hits(it.title);
    const allKw = hits(text);
    const companies = tagCompanies(text);
    const deptIns = !!(it.dept && /보험|계리/.test(it.dept));
    if (it.type === 'regulator') {
      if (!(deptIns || allKw.length)) continue; // 보험과 관련 없는 보도자료는 버려요
    } else if (it.general) {
      if (!(allKw.some((x) => !x.weak) || companies.length)) continue; // 종합 금융지는 보험 기사만
      // 네이버는 범위가 넓어서 제목에 보험 말이나 보험사 이름이 있어야 해요
      if (it.strict && !(kw.some((x) => !x.weak) || tagCompanies(it.title).length)) continue;
    }
    const score = (it.type === 'regulator' ? 3 : 0) + 2 * Math.min(kw.length, 3) + companies.length + (deptIns ? 2 : 0);
    const o = { id: '', source: it.source, type: it.type, title: it.title, url: it.url, date: it.date };
    if (it.time) o.time = it.time;
    if (it.dept) o.dept = it.dept;
    if (it.pdf) o.pdf = it.pdf;
    if (it.summary) o.summary = it.summary;
    if (it.author) o.author = it.author;
    Object.assign(o, { companies, score, group: 0, used: used.has(normUrl(it.url)) });
    items.push(o);
  }

  items.sort((a, b) => b.score - a.score || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || ((b.time || '') < (a.time || '') ? -1 : (b.time || '') > (a.time || '') ? 1 : 0));

  // 같은 사건끼리 묶기 (글자 두 개씩 겹침이 0.35 이상이면 같은 묶음)
  const grams = items.map((i) => bigrams(normTitle(i.title)));
  const full = items.map((i) => bigrams(normTitle(i.title + ' ' + (i.summary || ''))));
  // 당국 보도자료 제목이 기사 제목과 요약에 절반 넘게 들어 있으면 같은 사건으로 봐요
  const contained = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return a.size ? n / a.size : 0; };
  const par = items.map((_, i) => i);
  const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      let same = jaccard(grams[i], grams[j]) >= 0.35;
      if (!same && items[i].type !== items[j].type) {
        const [r, p] = items[i].type === 'regulator' ? [i, j] : [j, i];
        same = contained(grams[r], full[p]) >= 0.5;
      }
      if (same) par[find(j)] = find(i);
    }
  const gid = new Map();
  items.forEach((it, i) => {
    const r = find(i);
    if (!gid.has(r)) gid.set(r, gid.size + 1);
    it.group = gid.get(r);
    it.id = `c-${D}-${String(i + 1).padStart(3, '0')}`;
  });

  for (const s of sources) {
    s.count = items.filter((i) => i.source === s.name).length;
    delete s._list;
  }

  const dir = path.join(ROOT, 'candidates');
  fs.mkdirSync(dir, { recursive: true });
  const out = { date: D, collectedAt: kstNow().iso, sources, errors, items };
  fs.writeFileSync(path.join(dir, D + '.json'), JSON.stringify(out, null, 2) + '\n');

  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      `# 기사 후보 모음

매일 아침 \`node scripts/collect.mjs\`가 어제 나온 보험 기사 후보를 모아 \`날짜.json\`으로 저장해요. 매일 이슈를 쓸 때 웹 검색 대신 이 목록을 먼저 읽어요.

- \`date\`: 기준 날짜(한국 시간). 이 날과 다음 날 아침까지 나온 기사를 모아요.
- \`sources\`: 출처별 모은 건수(count)와 성공 여부(ok). \`errors\`에는 실패한 출처와 이유가 들어가요.
- \`items\`: 후보 기사 목록. 점수(score)가 높은 순이에요.
  - \`type\`: regulator(금융당국 보도자료) 또는 press(언론 기사)
  - \`dept\`: 보도자료 담당 부서, \`pdf\`: 금융위원회 첨부 pdf 주소
  - \`companies\`: 제목과 요약에 이름이 나온 보험사
  - \`score\`: 당국 자료 +3, 제목의 보험 키워드 +2씩(최대 3개), 보험사 이름 +1씩, 보험·계리 담당 부서 +2
  - \`group\`: 같은 사건으로 보이는 기사끼리 같은 번호예요(제목 비슷한 정도로 계산). 보도자료와 기사를 짝지을 때 써요.
  - \`used\`: true면 이미 이슈나 회사 소식의 출처로 쓴 기사예요.
- 45일이 지난 파일은 자동으로 지워요.
`
    );
  }

  // 45일 지난 파일 지우기
  const cut = addDays(D, -45);
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && m[1] < cut) { fs.unlinkSync(path.join(dir, f)); console.log(`오래된 파일 삭제: ${f}`); }
  }

  // ---------- 요약 ----------
  console.log('\n[출처별 건수]');
  for (const s of sources) console.log(`  ${s.name}: ${s.ok ? s.count + '건' : '실패'}`);
  errors.forEach((e) => console.log('  오류 - ' + e));
  console.log(`\n합계 ${items.length}건 (이미 쓴 기사 ${items.filter((i) => i.used).length}건, 묶음 ${gid.size}개)`);
  console.log('\n[점수 높은 상위 10건]');
  items.slice(0, 10).forEach((i) => console.log(`  ${String(i.score).padStart(2)}점 [${i.source}] ${i.title} (묶음 ${i.group})${i.used ? ' *사용함' : ''}`));
  console.log(`\n저장: candidates/${D}.json`);
}

main().catch((e) => {
  console.error('실패: ' + e.message);
  process.exit(1);
});
