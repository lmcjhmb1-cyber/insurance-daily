import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBody, fetchArticle, titleMatches } from '../fetch-articles.mjs';

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
  assert.throws(() => titleMatches('<html></html>', '제목'), /no_og_title/);
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
