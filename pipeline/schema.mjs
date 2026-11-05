// 구조화 출력용 JSON 스키마(작고 모든 항목이 필수인 것들)와, 결과를 코드에서 다시 확인하는 검사 함수들.
// 이슈 본문은 선택 항목이 많고 그림 종류가 갈려서(anyOf) 구조화 출력 대신 JSON 글로 받고 아래 validateIssue로 엄격하게 검사해요.

export const NEWS_KINDS = ['실적', '상품', '건전성', '제재·감독', '투자·인수', '경영·전략', '인사·조직', '판매·채널', '디지털', '사회공헌', '기타'];
export const COMIC = {
  bg: ['office', 'meeting', 'home', 'hospital', 'road', 'focus', 'night', 'plain'],
  board: ['up', 'down', 'flat'],
  who: ['potato', 'sweetpotato', 'onion', 'carrot', 'mango', 'strawberry', 'watermelon', 'insurer', 'driver', 'regulator', 'doctor', 'planner', 'fraudster'],
  mood: ['happy', 'worried', 'surprised', 'thinking', 'angry', 'sad'],
  pose: ['stand', 'point', 'cheer', 'think', 'phone', 'doc', 'worry', 'shrug'],
  fx: ['sweat', 'sparkle', 'question', 'exclaim', 'gloom', 'heart', 'idea'],
  bubble: ['talk', 'think', 'shout'],
};
const FIG_TYPES = ['bars', 'compare', 'timeline', 'split'];

// ---------- 구조화 출력 스키마 (모든 객체 additionalProperties:false, 항목은 전부 필수) ----------
const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const arr = (items) => ({ type: 'array', items });
const str = { type: 'string' };
const bool = { type: 'boolean' };

export const SELECT_SCHEMA = obj({
  issues: arr(obj({
    key: str, // 뉴스와 이어줄 때 쓰는 짧은 이름(i1, i2...)
    title: str,
    article_ids: arr(str),
    tag: str,
    thread: obj({ id: str, name: str }),
    companies: arr(str),
    jobs: arr(str),
    comic: obj({ include: bool, outline: str }),
    angle: str,
  })),
  news: arr(obj({ article_id: str, companies: arr(str), kind: { type: 'string', enum: NEWS_KINDS }, issue_ref: str })),
  note: str,
});
export const VERIFY_SCHEMA = obj({
  ok: bool,
  problems: arr(obj({ field: str, claim: str, problem: str, fix: str })),
});
export const NEWS_WRITE_SCHEMA = obj({ items: arr(obj({ article_id: str, title: str, text: str })) });
export const NEWS_VERIFY_SCHEMA = obj({ results: arr(obj({ article_id: str, ok: bool, problem: str })) });

// ---------- 코드 검사 ----------
const isStr = (s) => typeof s === 'string' && s.trim() !== '';
const isArr = Array.isArray;
function* strings(o, p = '') {
  if (typeof o === 'string') yield [p, o];
  else if (isArr(o)) for (let i = 0; i < o.length; i++) yield* strings(o[i], `${p}[${i}]`);
  else if (o && typeof o === 'object') for (const k of Object.keys(o)) yield* strings(o[k], p ? `${p}.${k}` : k);
}
const count = (s, sub) => s.split(sub).length - 1;

// scripts/check.mjs의 새 이슈(엄격) 규칙과 GUIDE 2~7번을 같은 기준으로 검사해요. errors는 꼭 고쳐야 하고, warnings는 검토 때 참고해요.
export function validateIssue(it, { jobs = [], companies = [] } = {}) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  if (!it || typeof it !== 'object') return { errors: ['이슈가 객체가 아니에요.'], warnings };

  for (const k of ['tag', 'title', 'why', 'summary']) if (!isStr(it[k])) err(`${k}가 없어요.`);
  const p = it.predict;
  if (!p || !isStr(p.q) || !isStr(p.reveal) || !isArr(p.options) || p.options.length !== 3 || !Number.isInteger(p.answer) || p.answer < 0 || p.answer > 2) err('predict는 q, options(3개), answer(0~2), reveal이 필요해요.');
  const b = it.brief;
  if (!b || !isStr(b.what) || !isStr(b.why) || !isStr(b.so)) err('brief에 what, why, so가 모두 있어야 해요.');
  if (!isArr(it.points) || it.points.length < 2 || it.points.length > 3 || !it.points.every(isStr)) err('points는 문장 2~3개예요.');
  if (!isArr(it.chain) || it.chain.length < 5 || it.chain.length > 7 || !it.chain.every(isStr)) err('chain은 5~7개 고리예요.');
  if (!it.role || !isStr(it.role.q) || !isStr(it.role.model)) err('role에 q와 model이 필요해요.');
  else if (!/["“][^"”“]+["”]/.test(it.role.q)) err('role.q에 큰따옴표로 감싼 상대의 말이 있어야 해요.');
  if (!it.interview || !isStr(it.interview.q) || !isStr(it.interview.guide)) err('interview에 q와 guide가 필요해요.');
  else for (const h of ['결론부터', '근거', '관점', '마무리']) if (!it.interview.guide.includes(h)) err(`interview.guide에 "${h}" 줄이 있어야 해요.`);

  if (!isArr(it.quiz) || it.quiz.length < 2 || it.quiz.length > 3) err('quiz는 2~3개예요.');
  else it.quiz.forEach((q, i) => {
    if (!isStr(q.q) || !isStr(q.e) || !isArr(q.o) || q.o.length !== 3 || !Number.isInteger(q.a) || q.a < 0 || q.a > 2) err(`quiz ${i + 1}: q, o(3개), a(0~2), e가 필요해요.`);
    if (q.deep !== undefined && q.deep !== true) err(`quiz ${i + 1}: deep은 true일 때만 써요.`);
  });
  const termNames = new Set();
  if (!isArr(it.terms) || it.terms.length < 3 || it.terms.length > 6) err('terms는 3~6개예요.');
  else it.terms.forEach((t, i) => { if (!isStr(t.t) || !isStr(t.d)) err(`terms ${i + 1}: t와 d가 필요해요.`); else termNames.add(t.t); });
  if (!isArr(it.pre) || it.pre.length < 1 || it.pre.length > 2 || !it.pre.every((t) => termNames.has(t))) err('pre는 terms의 t에 있는 용어 1~2개예요.');
  if (!it.thread || !isStr(it.thread.id) || !isStr(it.thread.name) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(it.thread.id)) err('thread에 id(영어 소문자와 하이픈)와 name이 필요해요.');
  if (!isArr(it.jobs) || it.jobs.length < 1 || it.jobs.length > 3 || !it.jobs.every((j) => jobs.includes(j))) err('jobs는 허용된 직무 1~3개예요.');
  if (it.companies !== undefined && (!isArr(it.companies) || !it.companies.every((c) => companies.includes(c)))) err('companies에 companies.js에 없는 이름이 있어요.');
  if (it.frames !== undefined) err('frames 항목은 넣지 않아요.');
  if (it.numbers !== undefined) {
    if (!isArr(it.numbers) || it.numbers.length < 3 || it.numbers.length > 4) err('numbers는 3~4개예요(없으면 생략).');
    else it.numbers.forEach((n, i) => { if (!isStr(n.label) || !isStr(n.value)) err(`numbers ${i + 1}: label, value가 필요해요.`); else if (n.value.length > 14) err(`numbers ${i + 1}: value가 14자를 넘어요.`); });
  }

  if (!isArr(it.figs) || it.figs.length < 1 || it.figs.length > 2) err('figs는 1~2개예요.');
  else it.figs.forEach((f, i) => {
    const w = `figs ${i + 1}`;
    if (!FIG_TYPES.includes(f.type)) return err(`${w}: type은 bars, compare, timeline, split 중 하나예요.`);
    if (!isStr(f.title) || !isStr(f.look)) err(`${w}: title과 look이 필요해요.`);
    if (f.type === 'compare') {
      if (!isArr(f.rows) || !f.rows.length || !f.rows.every((r) => isStr(r.label) && r.left !== undefined && r.right !== undefined)) err(`${w}: compare의 rows(label,left,right)가 필요해요.`);
    } else if (!isArr(f.items) || !f.items.length) err(`${w}: items가 필요해요.`);
    else if (f.type === 'bars' || f.type === 'split') { if (!f.items.every((x) => typeof x.value === 'number' && Number.isFinite(x.value))) err(`${w}: value는 숫자여야 해요.`); }
    else if (!f.items.every((x) => isStr(x.when) && isStr(x.label))) err(`${w}: timeline 항목에 when, label이 필요해요.`);
  });

  if (it.comic !== undefined) {
    const c = it.comic;
    if (!c || !isArr(c.panels) || c.panels.length !== 4) err('comic.panels는 4칸이어야 해요.');
    else c.panels.forEach((pn, i) => {
      const w = `comic ${i + 1}번 칸`;
      if (pn.bg !== undefined && !COMIC.bg.includes(pn.bg)) err(`${w}: bg 값이 목록에 없어요.`);
      if (pn.board !== undefined && !COMIC.board.includes(pn.board)) err(`${w}: board 값이 목록에 없어요.`);
      if (!isArr(pn.chars) || pn.chars.length < 1 || pn.chars.length > 2) { err(`${w}: 인물은 1~2명이에요.`); return; }
      pn.chars.forEach((ch) => {
        if (!COMIC.who.includes(ch.who)) err(`${w}: who "${ch.who}"는 목록에 없어요.`);
        if (!COMIC.mood.includes(ch.mood)) err(`${w}: mood "${ch.mood}"는 목록에 없어요.`);
        if (ch.pose !== undefined && !COMIC.pose.includes(ch.pose)) err(`${w}: pose 값이 목록에 없어요.`);
        if (ch.fx !== undefined && ch.fx !== '' && !COMIC.fx.includes(ch.fx)) err(`${w}: fx 값이 목록에 없어요.`);
        if (ch.bubble !== undefined && !COMIC.bubble.includes(ch.bubble)) err(`${w}: bubble 값이 목록에 없어요.`);
        if (ch.name !== undefined) err(`${w}: 인물에 name은 적지 않아요.`);
        if (typeof ch.say === 'string' && [...ch.say].length > 30) err(`${w}: 말풍선이 30자를 넘어요.`);
      });
    });
  }

  // 글 전체 규칙
  const clean = (s) => s.replace(/\$\$[\s\S]*?\$\$/g, '');
  for (const [pth, s] of strings(it)) {
    if (/면접/.test(s)) err(`${pth}: "면접"이라는 말은 쓰지 않아요.`);
    if (count(s, '$$') % 2) err(`${pth}: $$ 개수가 홀수예요.`);
    if (count(clean(s), '**') % 2) err(`${pth}: ** 개수가 홀수예요.`);
    if (/(^|\.)(id|type|bg|board|who|mood|pose|fx|bubble)$/.test(pth)) continue; // 영어 소문자가 허용되는 값
    if (/[A-Za-z]{2,}/.test(clean(s).replace(/\b(?:KB|DB|NH|ABL|AIA|MG|SGI|GA)\b/g, ''))) warn(`${pth}: 영어 단어나 약어가 섞여 있어요.`);
  }
  for (const k of ['title', 'tag', 'terms', 'chain', 'numbers', 'figs', 'comic']) if (it[k] !== undefined) for (const [pth, s] of strings(it[k], k)) if (s.includes('**')) err(`${pth}에는 **강조**를 쓰지 않아요.`);
  for (const k of ['title', 'terms', 'figs', 'numbers', 'comic']) if (it[k] !== undefined) for (const [pth, s] of strings(it[k], k)) if (s.includes('$$')) err(`${pth}에는 수식($$)을 쓰지 않아요.`);
  return { errors, warnings };
}

export function validateNews(n, { companies = [] } = {}) {
  const errors = [];
  if (!isStr(n.title)) errors.push('title이 없어요.');
  if (!isStr(n.text)) errors.push('text가 없어요.');
  if (!NEWS_KINDS.includes(n.kind)) errors.push('kind가 목록에 없어요.');
  if (!isArr(n.companies) || !n.companies.length || !n.companies.every((c) => companies.includes(c))) errors.push('companies가 비었거나 없는 이름이 있어요.');
  if (!n.source || !/^https?:\/\//.test(n.source.url || '') || !isStr(n.source.name)) errors.push('source가 없어요.');
  if ('point' in n) errors.push('point 항목은 넣지 않아요.');
  for (const [pth, s] of strings({ title: n.title, text: n.text })) if (/면접/.test(s) || s.includes('**')) errors.push(`${pth}: 면접이나 ** 표시는 쓰지 않아요.`);
  return { errors };
}

export function validateWeekly(w, { threadIds = new Set(), start, end } = {}) {
  const errors = [];
  if (w.id !== end || w.start !== start || w.end !== end) errors.push('id, start, end가 주간 범위와 달라요.');
  if (!isStr(w.title) || !isStr(w.takeaway) || !isStr(w.next)) errors.push('title, takeaway, next가 필요해요.');
  if (!isArr(w.big) || w.big.length < 2 || w.big.length > 4 || !w.big.every(isStr)) errors.push('big은 2~4문단이에요.');
  if (!isArr(w.flows) || !w.flows.length || !w.flows.every((f) => isStr(f.note) && threadIds.has(f.thread))) errors.push('flows의 thread는 실제 이어보기 id여야 하고 note가 필요해요.');
  for (const [pth, s] of strings(w)) if (/면접/.test(s) || count(s, '$$') % 2) errors.push(`${pth}: 면접 또는 $$ 짝 문제`);
  return { errors };
}
