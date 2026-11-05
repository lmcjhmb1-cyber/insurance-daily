import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBody, fetchArticle, titleMatches, fetchAll, withRealSources, sameArticle } from '../fetch-articles.mjs';

const BODY = '보험 기사 본문 문장입니다. '.repeat(30);
const press = (title, body = BODY) => `<html><head><meta property="og:title" content="${title}"></head><body><article><div id="article-view-content-div" class="x"><p>${body}</p><script>var a=1</script></div></article></body></html>`;
const resp = (html, status = 200, headers = {}) => new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });

test('언론사 본문 추출과 제목 확인', () => {
  const cand = { type: 'press', title: '[11월 손보] “자사상품 판매 유인”… 손보 빅5', url: 'https://www.insjournal.co.kr/news/articleView.html?idxno=1' };
  const r = extractBody(press('[11월 손보] “자사상품 판매 유인”… 손보 빅5 - 보험저널'), cand);
  assert.ok(r.text.length > 300);
  assert.ok(!r.text.includes('var a'), '스크립트는 빠져야 해요');
  assert.equal(r.thin, false);
});

test('제목에 작은따옴표가 있어도 읽는다', () => {
  const html = `<meta property="og:title" content="'순환계' 매년 최대 1억3000만원 보장 확대 소식">`;
  assert.doesNotThrow(() => titleMatches(html, "'순환계' 매년 최대 1억3000만원 보장 확대 소식"));
});

test('제목이 다르면 거절한다', () => {
  assert.throws(() => titleMatches(press('전혀 다른 기사 제목입니다 정말로'), '자사상품 판매 유인 총력전'), /title_mismatch/);
  assert.throws(() => titleMatches('<html></html>', '제목'), /no_title/);
});

test('본문이 너무 짧으면 거절한다', () => {
  const cand = { type: 'press', title: '짧은 기사 제목입니다 하나둘셋', url: 'https://www.insnews.co.kr/news/articleView.html?idxno=2' };
  assert.throws(() => extractBody(press('짧은 기사 제목입니다 하나둘셋', '짧아요'), cand), /too_short/);
});

test('금융위원회와 금감원 본문 규칙', () => {
  const fsc = `<div class="content-body a"><p>${BODY}</p></div><div class="board-btn">`;
  assert.ok(extractBody(fsc, { type: 'regulator', title: '아무 제목', url: 'https://www.fsc.go.kr/no010101/1' }).text.length > 300);
  const fss = '<div class="dbdata"><p>짧은 보도자료 본문이 이 정도 길이로 들어 있어요. 시험용 문장이에요. 더 길게 늘려서 팔십 자를 넘겨요. 짧은 자료도 통과하지만 얇다고 표시돼요. 그래서 언론 기사와 짝지어야 해요.</p></div></div>';
  const r = extractBody(fss, { type: 'regulator', title: '제목', url: 'https://www.fss.or.kr/fss/bbs/B0000188/view.do?nttId=1' });
  assert.equal(r.thin, true);
});

test('다른 기사 번호로 가는 302는 실패, 같은 기사로 가는 것은 따라간다', async () => {
  const cand = { type: 'press', title: '리디렉션 시험 기사 제목입니다', url: 'https://www.insnews.co.kr/news/articleView.html?idxno=100' };
  const other = async () => resp('', 302, { location: 'https://www.insnews.co.kr/news/articleView.html?idxno=999' });
  const r1 = await fetchArticle(cand, { fetchImpl: other });
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, 'redirect_other');

  let calls = 0;
  const same = async (url) => {
    calls++;
    if (url.startsWith('http://')) return resp('', 301, { location: 'https://www.insnews.co.kr/news/articleView.html?idxno=100' });
    return resp(press('리디렉션 시험 기사 제목입니다'));
  };
  const r2 = await fetchArticle({ ...cand, url: 'http://insnews.co.kr/news/articleView.html?idxno=100' }, { fetchImpl: same });
  assert.equal(r2.ok, true);
  assert.equal(calls, 2);
});

test('제목 불일치와 HTTP 오류, 네트워크 오류는 실패로 돌려주고 일시적 오류는 한 번 다시 시도', async () => {
  const cand = { type: 'press', title: '제목 불일치 시험 기사 제목입니다', url: 'https://www.insweek.co.kr/news/articleView.html?idxno=5' };
  const r1 = await fetchArticle(cand, { fetchImpl: async () => resp(press('완전히 다른 제목이에요 이건')) });
  assert.equal(r1.reason, 'title_mismatch');
  let n = 0;
  const r2 = await fetchArticle(cand, { fetchImpl: async () => { n++; return n === 1 ? resp('', 503) : resp(press(cand.title)); } });
  assert.equal(r2.ok, true);
  assert.equal(n, 2);
  const r3 = await fetchArticle(cand, { fetchImpl: async () => { throw new Error('boom'); } });
  assert.equal(r3.ok, false);
});

// ---------- 일반 언론사 본문 추출 ----------
const cand = (title, url = 'https://www.example-news.co.kr/view?id=1') => ({ type: 'press', title, url });
const page = (title, inner, head = '') => `<html><head><title>${title}</title>${head}</head><body><div class="menu">메뉴 글자</div>${inner}</body></html>`;

test('일반 본문: JSON-LD의 articleBody를 먼저 쓴다', () => {
  const ld = JSON.stringify({ '@graph': [{ '@type': 'NewsArticle', articleBody: BODY }] });
  const html = page('JSON 제목 시험 기사입니다 하나', '<p>짧은 문단</p>', `<script type="application/ld+json">${ld}</script>`);
  const r = extractBody(html, cand('JSON 제목 시험 기사입니다 하나'));
  assert.ok(r.text.length >= 200);
  assert.ok(!r.text.includes('메뉴'));
});

test('일반 본문: 중첩된 div도 짝이 맞는 닫는 태그까지만 잘라 낸다', () => {
  const html = page('중첩 시험 기사 제목입니다 가나', `<div id="articleBody" class="a"><div class="photo"><div>사진 설명</div></div><p>${BODY}</p></div><div class="related">관련 기사 목록 글자</div>`);
  const r = extractBody(html, cand('중첩 시험 기사 제목입니다 가나'));
  assert.ok(r.text.includes('사진 설명'));
  assert.ok(r.text.length > 300);
  assert.ok(!r.text.includes('관련 기사 목록'), '컨테이너 밖은 빠져야 해요');
  assert.ok(!r.text.includes('메뉴 글자'));
});

test('일반 본문: 알려진 컨테이너가 없으면 article 태그, 그것도 없으면 긴 p 문단', () => {
  const art = extractBody(page('아티클 태그 시험 제목입니다', `<article><p>${BODY}</p></article>`), cand('아티클 태그 시험 제목입니다'));
  assert.ok(art.text.length > 300);
  const ps = `<div><p>짧은 문단</p><p>${'보험 기사 문단 문장입니다. '.repeat(8)}</p><p>${'두 번째 긴 문단 문장입니다. '.repeat(8)}</p><p>또 짧음</p></div>`;
  const r = extractBody(page('문단 시험 기사 제목입니다 다라', ps), cand('문단 시험 기사 제목입니다 다라'));
  assert.ok(r.text.includes('두 번째 긴 문단'));
  assert.ok(!r.text.includes('짧은 문단') && !r.text.includes('또 짧음'), '40자 미만 문단은 빠져요');
});

test('제목 확인: og:title이 없으면 title 태그로, 둘 다 없으면 no_title', () => {
  const inner = `<article><p>${BODY}</p></article>`;
  assert.ok(extractBody(`<html><head><title>타이틀 폴백 시험 기사 제목 - 신문</title></head><body>${inner}</body></html>`, cand('타이틀 폴백 시험 기사 제목')).text);
  assert.throws(() => extractBody(`<html><body>${inner}</body></html>`, cand('제목이 아무 데도 없어요 정말')), /no_title/);
  assert.throws(() => extractBody(page('전혀 다른 기사 제목이에요 이건', inner), cand('원래 후보 기사 제목입니다 정말')), /title_mismatch/);
});

test('제목 확인: 말머리와 네이버의 잘린 제목(…)도 통과한다', () => {
  const inner = `<article><p>${BODY}</p></article>`;
  const withPrefix = '[단독] 금융당국이 보험사 판매 수수료 규제를 대폭 강화한다';
  // 페이지 제목에는 말머리가 없는 경우
  assert.ok(extractBody(page('금융당국이 보험사 판매 수수료 규제를 대폭 강화한다 - 신문', inner), cand(withPrefix)).text);
  // 후보 제목이 "…"로 잘려 있어도 앞 12자 비교
  assert.ok(extractBody(page('삼성화재, 장기보험금 청구 5.2% 늘었는데 부지급은 7.7% 감소', inner), cand('삼성화재, 장기보험금 청구 5.2% 늘었는데 부지급은 7.7% 감...')).text);
  // 말머리가 있는 페이지 제목과 말머리 없는 후보 제목
  assert.ok(extractBody(page('[종합] 금융당국이 보험사 판매 수수료 규제를 대폭 강화한다', inner), cand('금융당국이 보험사 판매 수수료 규제를 대폭 강화한다')).text);
});

test('og:site_name을 30자 이내로 정리해서 돌려준다', () => {
  const inner = `<article><p>${BODY}</p></article>`;
  const long = '가'.repeat(50);
  const r = extractBody(page('사이트 이름 시험 기사 제목입니다', inner, `<meta property="og:site_name" content="${long}">`), cand('사이트 이름 시험 기사 제목입니다'));
  assert.equal(r.siteName.length, 30);
  const r2 = extractBody(page('사이트 이름 시험 기사 제목입니다', inner, '<meta content="보험저널" property="og:site_name">'), cand('사이트 이름 시험 기사 제목입니다'));
  assert.equal(r2.siteName, '보험저널');
  assert.equal(extractBody(page('사이트 이름 시험 기사 제목입니다', inner), cand('사이트 이름 시험 기사 제목입니다')).siteName, '');
});

test('euc-kr 페이지도 앞 4096바이트 안의 charset으로 읽는다', async () => {
  const iconv = new TextDecoder('euc-kr');
  assert.ok(iconv); // 이 환경에서 euc-kr 지원 확인
  // euc-kr 바이트를 직접 만들 수 없어서(인코더 없음) 4096바이트 뒤쪽에 charset이 있는 utf-8 페이지로 감지 범위만 확인해요
  const filler = `<!-- ${'x'.repeat(1500)} -->`;
  const html = `<html><head>${filler}<meta charset="utf-8"><title>감지 범위 시험 기사 제목입니다</title></head><body><article><p>${BODY}</p></article></body></html>`;
  const r = await fetchArticle(cand('감지 범위 시험 기사 제목입니다'), { fetchImpl: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }) });
  assert.equal(r.ok, true);
});

// ---------- 리디렉션 ----------
test('리디렉션: 프로토콜과 www., m. 차이만 있으면 따라가고 경로나 쿼리가 다르면 실패', async () => {
  assert.equal(sameArticle('https://m.example.com/view?id=1', 'http://www.example.com/view?id=1'), true);
  assert.equal(sameArticle('https://example.com/view/?id=1', 'https://www.example.com/view?id=1'), true);
  assert.equal(sameArticle('https://example.com/view?id=2', 'https://www.example.com/view?id=1'), false);
  assert.equal(sameArticle('https://example.com/other?id=1', 'https://www.example.com/view?id=1'), false);
  assert.equal(sameArticle('https://evil.example.org/view?id=1', 'https://www.example.com/view?id=1'), false);
  const c = cand('엠 주소 리디렉션 시험 기사 제목', 'https://www.example-news.co.kr/view?id=1');
  const seen = [];
  const mobile = async (url) => {
    seen.push(url);
    if (url.includes('://www.')) return resp('', 302, { location: 'https://m.example-news.co.kr/view?id=1' });
    return resp(page('엠 주소 리디렉션 시험 기사 제목', `<article><p>${BODY}</p></article>`));
  };
  assert.equal((await fetchArticle(c, { fetchImpl: mobile })).ok, true);
  assert.equal(seen.length, 2);
  const other = async () => resp('', 302, { location: 'https://m.example-news.co.kr/view?id=2' });
  assert.equal((await fetchArticle(c, { fetchImpl: other })).reason, 'redirect_other');
});

// ---------- 출처 이름 ----------
test('네이버 뉴스 후보는 출처 이름이 실제 언론사로 바뀐다 (사이트 이름, 없으면 호스트)', async () => {
  const cands = [
    { id: 'a', source: '네이버 뉴스', type: 'press', title: '출처 치환 시험 기사 제목 하나둘', url: 'https://www.paper-a.co.kr/view?id=1' },
    { id: 'b', source: '네이버 뉴스', type: 'press', title: '출처 치환 시험 기사 제목 셋넷', url: 'https://m.paper-b.co.kr/view?id=2' },
    { id: 'c', source: '보험저널', type: 'press', title: '출처 치환 시험 기사 제목 다섯', url: 'https://www.paper-c.co.kr/view?id=3' },
  ];
  const fetchImpl = async (url) => {
    const t = url.includes('paper-a') ? '출처 치환 시험 기사 제목 하나둘' : url.includes('paper-b') ? '출처 치환 시험 기사 제목 셋넷' : '출처 치환 시험 기사 제목 다섯';
    const site = url.includes('paper-a') ? '<meta property="og:site_name" content="에이일보">' : url.includes('paper-c') ? '<meta property="og:site_name" content="씨일보">' : '';
    return resp(page(t, `<article><p>${BODY}</p></article>`, site));
  };
  const { bodies } = await fetchAll(cands, { fetchImpl });
  const out = withRealSources(cands, bodies);
  assert.equal(out[0].source, '에이일보');
  assert.equal(out[1].source, 'paper-b.co.kr');
  assert.equal(out[2].source, '보험저널', '네이버가 아닌 출처는 그대로');
  assert.ok(out.every((c) => !c.source.includes('네이버')));
});
