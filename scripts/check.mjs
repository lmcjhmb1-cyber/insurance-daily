// 올리기 전 검사: GUIDE.md 8번 5단계와 2~6번 규칙을 확인해요.
// 사용법: node scripts/check.mjs [--since YYYY-MM-DD]
//   --since 를 주면 엄격한 새 이슈 검사(brief, pre, look 등)를 그 날짜 이후 이슈에만 적용해요.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadWindow, normUrl } from './_lib.mjs';
import { syncData } from './build-data.mjs';

const args = process.argv.slice(2);
const si = args.indexOf('--since');
const SINCE = si >= 0 ? args[si + 1] : '0000-00-00';
if (si >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(SINCE || '')) {
  console.error('--since 뒤에는 YYYY-MM-DD 날짜를 써주세요.');
  process.exit(2);
}

const problems = []; // { level, cat, id, msg }
const err = (cat, id, msg) => problems.push({ level: '오류', cat, id, msg });
const warn = (cat, id, msg) => problems.push({ level: '주의', cat, id, msg });

// ---------- 허용 값 (GUIDE.md 3번) ----------
const G = {
  bg: ['office', 'meeting', 'home', 'hospital', 'road', 'focus', 'night', 'plain'],
  board: ['up', 'down', 'flat'],
  who: ['potato', 'sweetpotato', 'onion', 'carrot', 'mango', 'strawberry', 'watermelon', 'insurer', 'driver', 'regulator', 'doctor', 'planner', 'fraudster'],
  mood: ['happy', 'worried', 'surprised', 'thinking', 'angry', 'sad'],
  pose: ['stand', 'point', 'cheer', 'think', 'phone', 'doc', 'worry', 'shrug'],
  fx: ['sweat', 'sparkle', 'question', 'exclaim', 'gloom', 'heart', 'idea'],
  bubble: ['talk', 'think', 'shout'],
};
const FIG_TYPES = ['bars', 'compare', 'timeline', 'split'];
const NEWS_KINDS = ['실적', '상품', '건전성', '제재·감독', '투자·인수', '경영·전략', '인사·조직', '판매·채널', '디지털', '사회공헌', '기타'];

// ---------- 데이터 읽기 ----------
const W = {};
for (const f of ['issues', 'frames', 'weekly', 'basics', 'companies', 'news', 'profiles', 'lessons']) {
  try {
    Object.assign(W, loadWindow(f + '.js'));
  } catch (e) {
    err('파일 불러오기', f + '.js', '불러오지 못했어요: ' + e.message);
  }
}
const ISSUES = W.ISSUES || [], NEWS = W.NEWS || [], WEEKLY = W.WEEKLY || [], BASICS = W.BASICS || [], COMPANIES = W.COMPANIES || [], JOBS = W.JOBS || [];
for (const [k, v] of Object.entries({ ISSUES, NEWS, WEEKLY, BASICS, COMPANIES, JOBS })) if (!v.length) err('파일 불러오기', k, `window.${k}가 비어 있거나 없어요.`);
const compNames = new Set(COMPANIES.map((c) => c.name));

// ---------- 공용 ----------
const isStr = (s) => typeof s === 'string' && s.trim() !== '';
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const num = (v) => typeof v === 'number' && Number.isFinite(v);
function* strings(o, p = '') {
  if (typeof o === 'string') yield [p, o];
  else if (Array.isArray(o)) for (let i = 0; i < o.length; i++) yield* strings(o[i], `${p}[${i}]`);
  else if (o && typeof o === 'object') for (const k of Object.keys(o)) yield* strings(o[k], p ? `${p}.${k}` : k);
}
const count = (s, sub) => s.split(sub).length - 1;

// ---------- comic.js와 GUIDE 비교 ----------
function comicSets() {
  const src = fs.readFileSync(path.join(ROOT, 'comic.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const fn = (name) => {
    const a = src.indexOf('function ' + name);
    if (a < 0) return '';
    const b = src.indexOf('\nfunction ', a + 5);
    return src.slice(a, b < 0 ? undefined : b);
  };
  const cases = (name) => [...fn(name).matchAll(/case "([a-z]+)"/g)].map((m) => m[1]);
  const castBody = (src.match(/const CAST=\{([\s\S]*?)\n\};/) || [])[1] || '';
  const aliasBody = (src.match(/const ALIAS=\{([^}]*)\}/) || [])[1] || '';
  return {
    bg: [...new Set([...cases('bgSVG'), 'plain'])],
    board: [...['up', 'down'].filter((d) => fn('bgSVG').includes(`"${d}"`)), 'flat'], // flat은 나머지 값의 기본 모양
    who: [...castBody.matchAll(/^\s+([a-z]+):\{name:/gm)].map((m) => m[1]),
    alias: [...aliasBody.matchAll(/([a-z0-9]+):"/g)].map((m) => m[1]),
    mood: cases('faceSVG'),
    pose: [...new Set([...cases('armsSVG'), 'stand'])],
    fx: cases('fxSVG'),
    bubble: [...new Set(['talk', ...[...html.matchAll(/\.cp-b\.([a-z]+)\{/g)].map((m) => m[1]).filter((x) => !['c', 'l', 'r'].includes(x))])],
  };
}
let CJ = null;
try {
  CJ = comicSets();
  for (const k of Object.keys(G)) {
    const onlyGuide = G[k].filter((x) => !CJ[k].includes(x));
    const onlyComic = CJ[k].filter((x) => !G[k].includes(x));
    if (onlyGuide.length) warn('GUIDE와 comic.js 불일치', k, `GUIDE에는 있는데 comic.js에서 못 찾은 값: ${onlyGuide.join(', ')}`);
    if (onlyComic.length) warn('GUIDE와 comic.js 불일치', k, `comic.js에는 있는데 GUIDE에 없는 값: ${onlyComic.join(', ')}`);
  }
} catch (e) {
  warn('GUIDE와 comic.js 불일치', 'comic.js', '값 목록을 읽지 못했어요: ' + e.message);
}

// ---------- 이어보기 묶음 ----------
const threadNames = new Map(); // id -> Set(name)
for (const b of BASICS) {
  if (!threadNames.has(b.id)) threadNames.set(b.id, new Set());
  if (b.name) threadNames.get(b.id).add(b.name);
}
for (const it of ISSUES) if (it.thread && it.thread.id) {
  if (!threadNames.has(it.thread.id)) threadNames.set(it.thread.id, new Set());
}

// ---------- 이슈 ----------
const seen = new Set();
const issueIds = new Set(ISSUES.map((i) => i.id));
let strictCount = 0;
function checkComic(id, c, strict) {
  if (!c || typeof c !== 'object') return err('만화', id, 'comic이 객체가 아니에요.');
  if (!isStr(c.title)) warn('만화', id, 'comic.title이 없어요.');
  if (!Array.isArray(c.panels) || c.panels.length !== 4) return err('만화', id, `칸이 4개여야 해요 (지금 ${Array.isArray(c.panels) ? c.panels.length : '없음'}개).`);
  c.panels.forEach((p, i) => {
    const w = `${i + 1}번 칸`;
    if (!isStr(p.caption)) warn('만화', id, `${w}: caption이 없어요.`);
    if (p.bg !== undefined && !G.bg.includes(p.bg)) err('만화 값', id, `${w}: bg "${p.bg}"는 허용 목록에 없어요.`);
    if (p.board !== undefined && !G.board.includes(p.board)) err('만화 값', id, `${w}: board "${p.board}"는 허용 목록에 없어요.`);
    if (p.board && !['office', 'meeting'].includes(p.bg)) warn('만화', id, `${w}: board는 office나 meeting 배경에서만 보여요.`);
    if (!Array.isArray(p.chars) || p.chars.length < 1) return err('만화', id, `${w}: 인물이 없어요.`);
    if (p.chars.length > 2) warn('만화', id, `${w}: 인물은 1~2명이에요 (지금 ${p.chars.length}명).`);
    p.chars.forEach((ch, k) => {
      const cw = `${w} 인물 ${k + 1}`;
      if (!G.who.includes(ch.who)) {
        if (CJ && CJ.alias.includes(ch.who)) warn('만화 값', id, `${cw}: who "${ch.who}"는 comic.js에서만 받는 옛 이름이에요.`);
        else err('만화 값', id, `${cw}: who "${ch.who}"는 허용 목록에 없어요.`);
      }
      if (!G.mood.includes(ch.mood)) err('만화 값', id, `${cw}: mood "${ch.mood}"는 허용 목록에 없어요.`);
      if (ch.pose !== undefined && !G.pose.includes(ch.pose)) err('만화 값', id, `${cw}: pose "${ch.pose}"는 허용 목록에 없어요.`);
      if (ch.fx !== undefined && ch.fx !== '' && !G.fx.includes(ch.fx)) err('만화 값', id, `${cw}: fx "${ch.fx}"는 허용 목록에 없어요.`);
      if (ch.bubble !== undefined && !G.bubble.includes(ch.bubble)) err('만화 값', id, `${cw}: bubble "${ch.bubble}"는 허용 목록에 없어요.`);
      if (ch.name !== undefined) warn('만화', id, `${cw}: name은 적지 않아요(이름표는 who로 자동).`);
      if (typeof ch.say === 'string' && [...ch.say].length > 30) warn('만화 말풍선 길이', id, `${cw}: 말풍선이 30자를 넘어요 (${[...ch.say].length}자).`);
    });
  });
}

function checkFigs(id, figs, strict, basic) {
  if (!Array.isArray(figs)) return err('그림', id, 'figs가 배열이 아니에요.');
  if (strict && (figs.length < 1 || figs.length > 2)) warn('그림 개수', id, `그림은 1~2개예요 (지금 ${figs.length}개).`);
  if (strict && basic && !figs.some((f) => f.type === 'timeline')) warn('그림 개수', id, '기초 이슈에는 timeline 그림을 꼭 넣어요.');
  figs.forEach((f, i) => {
    const w = `그림 ${i + 1}`;
    if (!FIG_TYPES.includes(f.type)) return err('그림 형식', id, `${w}: type "${f.type}"는 bars·compare·timeline·split 중 하나여야 해요.`);
    if (!isStr(f.title)) warn('그림', id, `${w}: title이 없어요.`);
    if (strict && !isStr(f.look)) err('그림 look', id, `${w}(${f.type}): look(이 그림에서 볼 것)이 없어요.`);
    if (!Array.isArray(f.items) && f.type !== 'compare') return err('그림 형식', id, `${w}: items가 없어요.`);
    if (f.type === 'bars' || f.type === 'split') {
      (f.items || []).forEach((x, k) => { if (!num(x.value)) err('그림 숫자', id, `${w} 항목 ${k + 1}("${x.label}"): value가 숫자가 아니에요.`); });
      if (f.type === 'bars' && f.ref && !num(f.ref.value)) err('그림 숫자', id, `${w}: ref.value가 숫자가 아니에요.`);
    }
    if (f.type === 'compare') {
      if (!Array.isArray(f.rows) || !f.rows.length) err('그림 형식', id, `${w}: compare의 rows가 없어요.`);
      else f.rows.forEach((r, k) => { if (!isStr(r.label) || r.left === undefined || r.right === undefined) err('그림 형식', id, `${w} 줄 ${k + 1}: label, left, right가 필요해요.`); });
    }
    if (f.type === 'timeline') (f.items || []).forEach((x, k) => { if (!isStr(x.when) || !isStr(x.label)) err('그림 형식', id, `${w} 항목 ${k + 1}: when, label이 필요해요.`); });
  });
}

for (const it of ISSUES) {
  const id = it.id || '(아이디 없음)';
  const strict = typeof it.date === 'string' && it.date >= SINCE;
  if (strict) strictCount++;
  const basic = it.basic === true;

  // 기본 구조 (모든 이슈)
  if (!isStr(it.id) || !/^\d{4}-\d{2}-\d{2}-b?\d+$/.test(it.id)) err('기본 항목', id, 'id는 "YYYY-MM-DD-번호"(기초는 -b번호) 모양이어야 해요.');
  else {
    if (seen.has(it.id)) err('기본 항목', id, '같은 id가 두 번 있어요.');
    seen.add(it.id);
    if (it.date && it.id.slice(0, 10) !== it.date) err('기본 항목', id, `id의 날짜와 date(${it.date})가 달라요.`);
    if (basic !== /-b\d+$/.test(it.id)) err('기본 항목', id, basic ? 'basic 이슈인데 id에 b가 없어요.' : 'id에 b가 있는데 basic이 true가 아니에요.');
  }
  if (!isDate(it.date)) err('기본 항목', id, `date가 올바른 날짜가 아니에요: ${it.date}`);
  for (const k of ['tag', 'title', 'why']) if (!isStr(it[k])) err('필수 항목', id, `${k}가 없어요.`);
  if (!Array.isArray(it.points) || !it.points.length || !it.points.every(isStr)) err('필수 항목', id, 'points가 없거나 글 목록이 아니에요.');
  else if (strict && (it.points.length < 2 || it.points.length > 3)) warn('개수', id, `points는 2~3문장이에요 (지금 ${it.points.length}개).`);

  const p = it.predict;
  if (!p || !isStr(p.q) || !isStr(p.reveal)) err('필수 항목', id, 'predict에 q 또는 reveal이 없어요.');
  else if (!Array.isArray(p.options) || p.options.length !== 3) err('예측 문제', id, `predict.options는 3개여야 해요 (지금 ${Array.isArray(p.options) ? p.options.length : '없음'}개).`);
  if (p && Array.isArray(p.options) && !(Number.isInteger(p.answer) && p.answer >= 0 && p.answer < p.options.length)) err('예측 문제', id, `predict.answer(${p.answer})가 선지 범위를 벗어나요.`);

  if (!Array.isArray(it.quiz) || !it.quiz.length) err('필수 항목', id, 'quiz가 없어요.');
  else {
    if (strict && (it.quiz.length < 2 || it.quiz.length > 3)) warn('개수', id, `quiz는 2~3개예요 (지금 ${it.quiz.length}개).`);
    it.quiz.forEach((q, i) => {
      if (!isStr(q.q) || !isStr(q.e)) err('퀴즈', id, `퀴즈 ${i + 1}: q 또는 e(해설)가 없어요.`);
      if (!Array.isArray(q.o) || q.o.length !== 3) strict ? err('퀴즈', id, `퀴즈 ${i + 1}: 선지(o)는 3개여야 해요.`) : warn('퀴즈', id, `퀴즈 ${i + 1}: 선지(o)가 3개가 아니에요 (${q.o && q.o.length}개).`);
      if (!Array.isArray(q.o) || !(Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length)) err('퀴즈 정답 범위', id, `퀴즈 ${i + 1}: a(${q.a})가 선지 범위를 벗어나요.`);
      if (q.deep !== undefined && q.deep !== true) warn('퀴즈', id, `퀴즈 ${i + 1}: deep은 true일 때만 써요.`);
    });
  }

  const termNames = new Set();
  if (!Array.isArray(it.terms) || !it.terms.length) err('필수 항목', id, 'terms가 없어요.');
  else {
    it.terms.forEach((t, i) => { if (!isStr(t.t) || !isStr(t.d)) err('용어', id, `용어 ${i + 1}: t 또는 d가 없어요.`); else termNames.add(t.t); });
    if (strict && (it.terms.length < 3 || it.terms.length > 6)) warn('개수', id, `terms는 3~6개예요 (지금 ${it.terms.length}개).`);
  }

  if (!it.thread || !isStr(it.thread.id) || !isStr(it.thread.name)) err('이어보기', id, 'thread에 id와 name이 필요해요.');
  else {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(it.thread.id)) err('이어보기', id, `thread.id "${it.thread.id}"는 영어 소문자와 하이픈이어야 해요.`);
    if (!threadNames.has(it.thread.id)) threadNames.set(it.thread.id, new Set());
    threadNames.get(it.thread.id).add(it.thread.name);
  }

  if (!Array.isArray(it.jobs) || !it.jobs.length) err('직무', id, 'jobs가 없어요.');
  else {
    if (it.jobs.length > 3) warn('직무', id, `jobs는 1~3개예요 (지금 ${it.jobs.length}개).`);
    for (const j of it.jobs) if (!JOBS.includes(j)) err('직무', id, `jobs의 "${j}"는 frames.js의 JOBS에 없어요.`);
  }

  if (it.frames !== undefined) (strict ? err : warn)('frames', id, 'frames 항목은 넣지 않아요(생각의 틀은 사이트에서 뺐어요).');

  if (it.companies !== undefined) {
    if (!Array.isArray(it.companies)) err('회사 이름', id, 'companies가 배열이 아니에요.');
    else for (const c of it.companies) if (!compNames.has(c)) err('회사 이름', id, `companies의 "${c}"는 companies.js의 name에 없어요.`);
  }

  if (!Array.isArray(it.sources) || !it.sources.length) err('출처', id, 'sources가 없어요.');
  else it.sources.forEach((s, i) => { if (!isStr(s.name) || !/^https?:\/\//.test(s.url || '')) err('출처', id, `출처 ${i + 1}: name 또는 http 주소(url)가 없어요.`); });

  if (it.figs !== undefined) checkFigs(id, it.figs, strict, basic);
  else if (strict) warn('그림 개수', id, 'figs가 없어요.');
  if (it.comic !== undefined) checkComic(id, it.comic, strict);

  if (it.numbers !== undefined) {
    if (!Array.isArray(it.numbers)) err('숫자 타일', id, 'numbers가 배열이 아니에요.');
    else {
      it.numbers.forEach((n, i) => { if (!isStr(n.label) || !isStr(n.value)) err('숫자 타일', id, `숫자 ${i + 1}: label 또는 value가 없어요.`); else if (n.value.length > 14) warn('숫자 타일', id, `숫자 ${i + 1}: value가 길어요("${n.value}").`); });
      if (strict && (it.numbers.length < 3 || it.numbers.length > 4)) warn('개수', id, `numbers는 3~4개예요 (지금 ${it.numbers.length}개).`);
    }
  }

  // 엄격 검사 (새 이슈 규칙)
  if (strict) {
    const b = it.brief;
    if (!b || !isStr(b.what) || !isStr(b.why) || !isStr(b.so)) err('brief', id, 'brief에 what, why, so가 모두 있어야 해요.');
    if (!Array.isArray(it.pre) || it.pre.length < 1 || it.pre.length > 2) err('pre', id, `pre는 용어 1~2개여야 해요 (지금 ${Array.isArray(it.pre) ? it.pre.length : '없음'}개).`);
    else for (const t of it.pre) if (!termNames.has(t)) err('pre', id, `pre의 "${t}"는 terms의 t에 없어요.`);
    if (!Array.isArray(it.chain) || !it.chain.length) err('필수 항목', id, 'chain이 없어요.');
    else if (it.chain.length < 5 || it.chain.length > 7) warn('개수', id, `chain은 5~7개 고리예요 (지금 ${it.chain.length}개).`);
    if (!it.role || !isStr(it.role.q) || !isStr(it.role.model)) err('필수 항목', id, 'role에 q와 model이 필요해요.');
    else if (!/["“][^"”“]+["”]/.test(it.role.q)) warn('role', id, 'role.q에 큰따옴표로 감싼 상대의 말이 없어요.');
    if (!isStr(it.summary)) err('필수 항목', id, 'summary가 없어요.');
    if (!it.interview || !isStr(it.interview.q) || !isStr(it.interview.guide)) err('필수 항목', id, 'interview에 q와 guide가 필요해요.');
    else {
      if (/면접/.test(it.interview.q + it.interview.guide)) err('interview 말투', id, 'interview에 "면접"이라는 말이 들어 있어요.');
      for (const h of ['결론부터', '근거', '관점', '마무리']) if (!it.interview.guide.includes(h)) warn('interview 형식', id, `interview.guide에 "${h}" 줄이 없어요.`);
    }
    // 강조 표시를 쓰면 안 되는 곳
    for (const k of ['title', 'tag', 'terms', 'chain', 'numbers', 'figs', 'comic']) if (it[k] !== undefined) for (const [pth, s] of strings(it[k], k)) if (s.includes('**')) err('강조 표시 위치', id, `${pth}에는 **강조**를 쓰지 않아요.`);
    // 수식은 제목, 용어, 그림, 숫자, 만화에 쓰지 않아요
    for (const k of ['title', 'terms', 'figs', 'numbers', 'comic']) if (it[k] !== undefined) for (const [pth, s] of strings(it[k], k)) if (s.includes('$$')) err('수식 위치', id, `${pth}에는 수식($$)을 쓰지 않아요.`);
  }

  // 글 전체 검사 (모든 이슈)
  for (const [pth, s] of strings(it)) {
    if (count(s, '$$') % 2) err('수식 짝', id, `${pth}: $$ 개수가 홀수예요.`);
    else {
      const segs = s.split('$$');
      for (let i = 1; i < segs.length; i += 2) if (segs[i].includes('**')) err('수식 안 강조', id, `${pth}: 수식 안에 **강조**가 들어 있어요.`);
    }
    if (count(s.replace(/\$\$[\s\S]*?\$\$/g, ''), '**') % 2) warn('강조 짝', id, `${pth}: ** 개수가 홀수예요.`);
  }
}

// 같은 thread.id에 이름이 여러 개면 알려요
for (const [tid, names] of threadNames) if (names.size > 1) warn('이어보기 이름', tid, `같은 thread.id에 이름이 여러 개예요: ${[...names].join(' / ')}`);

// 이슈 정렬 확인
{
  const key = (i) => { const m = String(i.id).match(/-(b?)(\d+)$/); return m ? [m[1] ? 1 : 0, Number(m[2])] : [0, 0]; };
  for (let k = 1; k < ISSUES.length; k++) {
    const a = ISSUES[k - 1], b = ISSUES[k];
    const bad = a.date < b.date || (a.date === b.date && (key(a)[0] > key(b)[0] || (key(a)[0] === key(b)[0] && key(a)[1] > key(b)[1])));
    if (bad) warn('정렬', b.id, `이전 이슈(${a.id})와 순서가 맞지 않아요(최신순, 같은 날은 번호순).`);
  }
}

// ---------- 기초 다지기 ----------
for (const b of BASICS) {
  if (!isStr(b.id) || !isStr(b.name)) err('기초 다지기', b.id || '(아이디 없음)', 'id 또는 name이 없어요.');
  if (!Array.isArray(b.order)) err('기초 다지기', b.id, 'order가 배열이 아니에요.');
  else for (const oid of b.order) {
    const iss = ISSUES.find((x) => x.id === oid);
    if (!iss) err('기초 다지기', b.id, `order의 "${oid}"가 issues.js에 없어요.`);
    else if (!iss.basic) warn('기초 다지기', b.id, `order의 "${oid}"는 basic 이슈가 아니에요.`);
    else if (iss.thread && iss.thread.id !== b.id) warn('기초 다지기', b.id, `order의 "${oid}"는 thread.id가 "${iss.thread.id}"예요.`);
  }
}

// ---------- 회사 소식 ----------
{
  const ids = new Set(), urls = new Map();
  for (const n of NEWS) {
    const id = n.id || '(아이디 없음)';
    if (!isStr(n.id) || !/^n-\d{4}-\d{2}-\d{2}-\d+$/.test(n.id)) err('회사 소식', id, 'id는 "n-YYYY-MM-DD-번호" 모양이어야 해요.');
    else if (ids.has(n.id)) err('회사 소식', id, '같은 id가 두 번 있어요.');
    ids.add(n.id);
    if (!isDate(n.date)) err('회사 소식', id, `date가 올바른 날짜가 아니에요: ${n.date}`);
    else if (isStr(n.id) && n.id.slice(2, 12) !== n.date) warn('회사 소식', id, `id의 날짜와 date(${n.date})가 달라요.`);
    if (!isStr(n.title)) err('회사 소식', id, 'title이 없어요.');
    if (!Array.isArray(n.companies) || !n.companies.length) err('회사 소식', id, 'companies가 비어 있어요.');
    else for (const c of n.companies) if (!compNames.has(c)) err('회사 소식 회사 이름', id, `companies의 "${c}"는 companies.js의 name에 없어요.`);
    if (!n.source || !/^https?:\/\//.test(n.source.url || '')) err('회사 소식', id, 'source.url이 없어요.');
    else {
      const u = normUrl(n.source.url);
      if (urls.has(u)) (n.date >= SINCE ? err : warn)('회사 소식', id, `같은 기사 주소가 ${urls.get(u)}에도 있어요.`);
      else urls.set(u, id);
      if (!isStr(n.source.name)) warn('회사 소식', id, 'source.name이 없어요.');
    }
    if (!isStr(n.text)) warn('회사 소식', id, 'text가 없어요.');
    if (!NEWS_KINDS.includes(n.kind)) err('회사 소식', id, `kind "${n.kind}"는 허용 목록에 없어요.`);
    if (n.issue !== undefined && !issueIds.has(n.issue)) err('회사 소식', id, `issue "${n.issue}"가 issues.js에 없어요.`);
  }
  for (let k = 1; k < NEWS.length; k++) if (NEWS[k - 1].date < NEWS[k].date) warn('정렬', NEWS[k].id, '회사 소식이 최신순이 아니에요.');
}

// ---------- 주간 정리 ----------
{
  const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
  const ids = new Set();
  for (const w of WEEKLY) {
    const id = w.id || '(아이디 없음)';
    if (ids.has(w.id)) err('주간 정리', id, '같은 id가 두 번 있어요.');
    ids.add(w.id);
    for (const k of ['id', 'start', 'end']) if (!isDate(w[k])) err('주간 정리', id, `${k}가 올바른 날짜가 아니에요: ${w[k]}`);
    if (isDate(w.end) && isDate(w.start)) {
      if (w.id !== w.end) err('주간 정리', id, 'id는 end(일요일)와 같아야 해요.');
      if (dow(w.end) !== 0) err('주간 정리', id, 'end가 일요일이 아니에요.');
      if (dow(w.start) !== 1) err('주간 정리', id, 'start가 월요일이 아니에요.');
      if ((new Date(w.end) - new Date(w.start)) / 864e5 !== 6) err('주간 정리', id, 'start와 end는 6일 차이여야 해요.');
    }
    if (!isStr(w.title)) err('주간 정리', id, 'title이 없어요.');
    if (!Array.isArray(w.big) || !w.big.length) err('주간 정리', id, 'big이 없어요.');
    else if (w.big.length < 2 || w.big.length > 4) warn('주간 정리', id, `big은 2~4문단이에요 (지금 ${w.big.length}개).`);
    if (!isStr(w.takeaway)) err('주간 정리', id, 'takeaway가 없어요.');
    if (!isStr(w.next)) err('주간 정리', id, 'next가 없어요.');
    if (!Array.isArray(w.flows)) err('주간 정리', id, 'flows가 없어요.');
    else for (const f of w.flows) {
      if (!isStr(f.note)) warn('주간 정리', id, `flows의 "${f.thread}"에 note가 없어요.`);
      if (!threadNames.has(f.thread)) err('주간 정리 흐름', id, `flows.thread "${f.thread}"는 실제 thread id가 아니에요.`);
    }
    if (isDate(w.start) && isDate(w.end)) {
      const n = ISSUES.filter((i) => !i.basic && i.date >= w.start && i.date <= w.end).length;
      if (n < 3) warn('주간 정리', id, `그 주 basic이 아닌 이슈가 ${n}개예요(3개 미만이면 만들지 않아요).`);
    }
    for (const [pth, s] of strings(w)) if (count(s, '$$') % 2) err('수식 짝', id, `${pth}: $$ 개수가 홀수예요.`);
  }
  for (let k = 1; k < WEEKLY.length; k++) if (WEEKLY[k - 1].id < WEEKLY[k].id) warn('정렬', WEEKLY[k].id, '주간 정리가 id 최신순이 아니에요.');
}

// ---------- 회사 소개, 용어 학습 ----------
for (const k of Object.keys(W.PROFILES || {})) if (!compNames.has(k)) warn('회사 정보', k, 'profiles.js의 키가 companies.js의 name에 없어요.');
for (const [k, v] of Object.entries(W.LESSONS || {})) {
  for (const [pth, s] of strings(v)) if (count(s, '$$') % 2) err('수식 짝', k, `lessons.js ${pth}: $$ 개수가 홀수예요.`);
}

// ---------- app.js 문법 ----------
{
  const r = spawnSync(process.execPath, ['--check', path.join(ROOT, 'app.js')], { encoding: 'utf8' });
  if (r.status !== 0) err('app.js 문법', 'app.js', (r.stderr || r.error || '').toString().split('\n').slice(0, 4).join(' / '));
}

// ---------- data/ 폴더가 원본과 같은지 ----------
try {
  const { stale } = syncData({ check: true });
  if (stale.length) err('data 폴더', 'data/', `원본보다 오래됐어요. node scripts/build-data.mjs를 실행해 다시 만드세요. (${stale.slice(0, 3).join(', ')}${stale.length > 3 ? ` 외 ${stale.length - 3}개` : ''})`);
} catch (e) {
  err('data 폴더', 'data/', '확인하지 못했어요: ' + e.message);
}

// ---------- 결과 ----------
const errors = problems.filter((p) => p.level === '오류');
const warns = problems.filter((p) => p.level === '주의');
const byCat = (list) => {
  const m = new Map();
  for (const p of list) { if (!m.has(p.cat)) m.set(p.cat, []); m.get(p.cat).push(p); }
  return m;
};
console.log(`검사 대상: 이슈 ${ISSUES.length}개 (엄격 검사 ${strictCount}개${SINCE !== '0000-00-00' ? `, ${SINCE} 이후` : ', 전체'}), 회사 소식 ${NEWS.length}개, 주간 정리 ${WEEKLY.length}개, 기초 흐름 ${BASICS.length}개`);
for (const [title, list] of [['오류', errors], ['주의', warns]]) {
  if (!list.length) continue;
  console.log(`\n[${title}] ${list.length}건`);
  for (const [cat, ps] of byCat(list)) {
    console.log(` - ${cat}: ${ps.length}건`);
    for (const p of ps) console.log(`     ${p.id}: ${p.msg}`);
  }
}
console.log('\n[요약]');
for (const [title, list] of [['오류', errors], ['주의', warns]]) {
  console.log(` ${title} ${list.length}건` + (list.length ? ' (' + [...byCat(list)].map(([c, ps]) => `${c} ${ps.length}`).join(', ') + ')' : ''));
}
console.log(errors.length ? '\n검사 실패: 오류를 고친 뒤 다시 올려주세요.' : '\n검사 통과');
process.exit(errors.length ? 1 : 0);
