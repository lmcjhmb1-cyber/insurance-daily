// --mock 용 가짜 기사 서버와 가짜 모델. 네트워크와 API 키 없이 전체 흐름을 돌려보려고 만들었어요.
// 가짜 모델은 실제 transport와 같은 모양(메시지 객체)을 돌려줘서 llm.mjs의 예산, 거절, 비용 계산 코드가 그대로 쓰여요.

export const MOCK_SENTINEL = ['MOCK', 'BODY'].join(''); // 시험에서 본문이 저장소나 결과물에 새는지 찾는 표시 (소스에 글자 그대로 두지 않아요)

// ---------- 가짜 기사 서버 ----------
export function createMockFetch(cands) {
  const byUrl = new Map(cands.map((c) => [c.url, c]));
  return async (url) => {
    const c = byUrl.get(url);
    if (!c) return new Response('not found', { status: 404 });
    const para = (n) => `${MOCK_SENTINEL}-${c.id} 모의 기사 문단 ${n}입니다. 이 글은 시험을 위해 만든 가짜 본문이라 실제 기사와 관계가 없어요. `.repeat(3);
    let html;
    if (/fsc\.go\.kr/.test(url)) html = `<html><body><div class="content-body x"><p>${para(1)}</p><p>${para(2)}</p></div><div class="board-btn"></div></body></html>`;
    else if (/fss\.or\.kr/.test(url)) html = `<html><body><div class="dbdata"><p>${MOCK_SENTINEL}-${c.id} 짧은 모의 보도자료 본문이에요. 시험용 문장입니다. 금감원 자료는 원래 짧아서 이 정도 길이로 만들었어요.</p></div></div></body></html>`;
    else html = `<html><head><meta property="og:title" content="${c.title.replace(/"/g, '&quot;')}"><meta property="og:site_name" content="모의신문"></head><body><article><div id="article-view-content-div"><p>${para(1)}</p><p>${para(2)}</p><p>${para(3)}</p></div></article></body></html>`;
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
}

// ---------- 가짜 이슈 (GUIDE 엄격 규칙을 지키는 견본) ----------
export function fixtureIssue(assign) {
  const comic = {
    title: '가정에도 근거가 필요해',
    panels: [
      { caption: '소식이 전해진 날', bg: 'meeting', chars: [{ who: 'regulator', mood: 'thinking', pose: 'doc', say: '기준을 알려드립니다' }, { who: 'insurer', mood: 'surprised', fx: 'exclaim' }] },
      { caption: '보험사의 고민', bg: 'office', chars: [{ who: 'insurer', mood: 'worried', pose: 'worry', say: '준비할 게 늘었어요' }] },
      { caption: '계리사의 분석', bg: 'office', board: 'up', chars: [{ who: 'mango', mood: 'thinking', pose: 'think', say: '숫자부터 확인해요' }] },
      { caption: '망고 계리사의 정리', bg: 'plain', chars: [{ who: 'mango', mood: 'happy', pose: 'point', fx: 'idea', say: '근거가 곧 실력이에요' }] },
    ],
  };
  const issue = {
    tag: assign.tag,
    title: `${assign.title}`,
    predict: {
      q: '이번 소식에서 새로 달라지는 것은 무엇일까요?',
      options: ['보고 의무가 새로 생겨요', '보험료가 모두 내려가요', '모든 보험사가 합쳐져요'],
      answer: 0,
      reveal: '**보고 의무가 새로 생겼다**는 점이 핵심이에요. 모의 자료에 나온 내용만 담았어요.',
    },
    brief: {
      what: '모의 자료에서 당국이 새로운 보고 기준을 발표했어요.',
      why: '숫자의 근거를 확인하려는 흐름이 커졌기 때문이에요.',
      so: '보험사는 근거를 설명하는 일이 늘어날 수 있어요.',
    },
    pre: ['계리가정'],
    figs: [{ type: 'timeline', title: '적용 일정', look: '발표 뒤 적용 순서를 볼 수 있어요.', items: [{ when: '발표일', label: '개정안 의결', now: true }, { when: '다음 결산', label: '첫 보고' }] }],
    numbers: [
      { label: '보고 횟수', value: '매년', note: '모의 숫자예요' },
      { label: '적용 시점', value: '다음 결산', note: '모의 숫자예요' },
      { label: '대상', value: '모든 보험사', note: '모의 숫자예요' },
    ],
    points: [
      '당국은 계리가정의 **산출 근거**를 보고서로 내도록 했어요. 모의 자료에 나온 내용이에요.',
      '근거를 설명하는 일이 중요해질 수 있어요. 이것은 해석이에요.',
    ],
    why: '숫자 하나가 이익을 크게 바꾸기 때문에 **근거를 문서로 확인**하는 흐름이 생겼어요. 계리 직무에서는 설명하는 힘이 중요해질 수 있어요.',
    chain: ['가정이 바뀌면 부채가 달라져요', '숫자의 신뢰가 중요해져요', '보고 의무가 생겨요', '당국이 비교해요', '근거 설명이 중요해져요'],
    role: { q: '당신은 계리팀 신입이에요. 팀장님이 묻습니다. "이 보고서에 무엇을 담아야 할까?" 목차를 짜보세요.', model: '첫째, **산출 근거**를 적어요. 둘째, 작년과 달라진 점을 밝혀요. 셋째, 검증 결과를 보여줘요.' },
    summary: '보험사가 숫자를 왜 그렇게 잡았는지 보고서로 내야 한대.',
    interview: { q: '이번 소식이 계리 직무에 주는 변화를 말해보세요.', guide: '결론부터: 근거를 설명하는 일이 커진다고 말해요.\n근거: 모의 자료의 보고 의무를 들어요.\n관점: 계리 관점에서 검증이 핵심이라고 덧붙여요.\n마무리: 근거가 분명한 숫자를 만들고 싶다고 마무리해요.' },
    quiz: [
      { q: '이번 소식의 핵심 변화는?', o: ['보고 의무 신설', '보험료 일괄 인하', '보험사 합병 의무'], a: 0, e: '모의 자료에서 보고 의무가 새로 생겼어요.' },
      { q: '근거를 문서로 확인하려는 이유로 알맞은 것은?', o: ['숫자 하나가 이익을 크게 바꾸기 때문', '보험사가 늘어났기 때문', '상품 이름이 바뀌었기 때문'], a: 0, e: '가정 하나가 부채와 이익을 크게 바꿔요.' },
    ],
    terms: [
      { t: '계리가정', d: '보험료와 보험부채를 계산할 때 쓰는 예상 손해율, 해지율 같은 전제예요.' },
      { t: '보험부채', d: '보험사가 앞으로 지급해야 할 돈을 계산해 쌓아두는 금액이에요.' },
      { t: '검증', d: '계산한 숫자가 맞는지 다시 따져보는 일이에요.' },
    ],
    thread: assign.thread,
    jobs: assign.jobs,
  };
  if (assign.companies?.length) issue.companies = assign.companies;
  if (assign.comic?.include) issue.comic = comic;
  return issue;
}

// ---------- 가짜 용어 학습 (GUIDE 2-4번 형식을 지키는 견본) ----------
export function fixtureLesson(term) {
  return {
    easy: `${term}은 모의 자료에서 쓰는 **보험 용어**예요. 시험을 위한 설명이에요.`,
    analogy: '용돈을 미리 받아 한 달에 나눠 쓰는 것과 비슷해요. 시험을 위한 비유예요.',
    steps: [
      { h: '먼저 정해요', t: '기준이 되는 숫자를 정해요.' },
      { h: '나눠서 반영해요', t: '정한 숫자를 기간으로 나눠요. $$\\frac{100}{10} = 10$$' },
      { h: '결과를 확인해요', t: '해마다 반영되는 몫을 확인해요.' },
    ],
    example: { title: '예시 숫자로 계산해보기', rows: [{ label: '전체 금액', value: '100' }, { label: '기간', value: '10년' }, { label: '해마다 몫', value: '10', hi: true }], note: '100을 10년으로 나누면 해마다 10이에요. 설명을 위한 예시 숫자예요.' },
    vs: [{ t: '비슷한 말', d: '비슷하지만 **기준이 달라요**.' }],
    why: '숫자의 근거를 설명할 때 꼭 필요한 용어라서 계리와 상품개발에서 자주 만나요.',
    quiz: [
      { q: '100을 10년으로 나누면 해마다 얼마일까요?', o: ['5', '10', '20'], a: 1, e: '100을 10으로 나누면 10이에요.' },
      { q: '이 용어를 설명할 때 가장 알맞은 것은?', o: ['기간에 걸쳐 나눠 반영해요', '한 번에 모두 반영해요', '반영하지 않아요'], a: 0, e: '나눠서 반영하는 개념이에요.' },
    ],
    related: ['계리가정', '보험부채', '검증'],
  };
}

// ---------- 가짜 모델 ----------
const tagText = (s, name) => (s.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)) || [])[1];

// opts: { failVerify(label, n) -> bool, refuse(label) -> bool, badWriteOnce(label) -> bool, extraOutput(label) -> 출력 토큰 추가,
//         triageGroups(거르기에서 고를 사건 수), triageExtraIds(거르기가 덧붙일 id), failLesson(label) -> bool, badLessonOnce(label) -> bool }
export function createMockTransport(opts = {}) {
  const seen = new Map(); // 라벨별 호출 횟수
  const cached = new Set();
  const reply = (params, label, obj, extra = {}) => {
    const systemLen = params.system.map((b) => b.text).join('').length;
    const hit = cached.has(params.model);
    cached.add(params.model);
    const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return {
      model: params.model,
      stop_reason: 'end_turn',
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }],
      usage: {
        input_tokens: Math.ceil(params.messages[0].content.length / 2),
        output_tokens: Math.ceil(text.length / 2) + (opts.extraOutput?.(label) || 0), // 시험에서 비싼 호출을 흉내 낼 때
        cache_creation_input_tokens: hit ? 0 : Math.ceil(systemLen / 2),
        cache_read_input_tokens: hit ? Math.ceil(systemLen / 2) : 0,
      },
      ...extra,
    };
  };
  return async (params, meta) => {
    const label = meta.label;
    const n = (seen.get(label) || 0) + 1;
    seen.set(label, n);
    const user = params.messages[0].content;
    if (opts.refuse?.(label)) return reply(params, label, '', { stop_reason: 'refusal', content: [], stop_details: { category: 'general_harms' } });
    if (label === 'triage') {
      const cands = JSON.parse(tagText(user, '후보목록'));
      const groups = new Map();
      for (const c of cands) groups.set(c.group, [...(groups.get(c.group) || []), c]);
      const pickedGroups = [...groups.values()].filter((g) => g.some((c) => c.type === 'press')).sort((a, b) => Math.max(...b.map((c) => c.score)) - Math.max(...a.map((c) => c.score))).slice(0, opts.triageGroups ?? 4);
      const issue_ids = pickedGroups.map((g) => g.slice().sort((a, b) => b.score - a.score)[0].id);
      const news_ids = cands.filter((c) => c.companies?.length).slice(0, 12).map((c) => c.id);
      return reply(params, label, { issue_ids: [...issue_ids, ...(opts.triageExtraIds || [])], news_ids });
    }
    if (label === 'select') {
      const cands = JSON.parse(tagText(user, '후보목록'));
      const groups = new Map();
      for (const c of cands) groups.set(c.group, [...(groups.get(c.group) || []), c]);
      const picked = [...groups.values()].filter((g) => g.some((c) => c.type === 'press')).sort((a, b) => Math.max(...b.map((c) => c.score)) - Math.max(...a.map((c) => c.score))).slice(0, 3);
      const issues = picked.map((g, i) => ({
        key: `i${i + 1}`, title: `모의 이슈 ${i + 1}: ${g[0].title.slice(0, 20)}`, article_ids: g.map((c) => c.id), tag: '감독·계리',
        thread: { id: 'mock-thread', name: '모의 흐름' }, companies: [], jobs: ['계리'], comic: { include: i === 0, outline: '모의 4칸' }, angle: '모의 관점',
      }));
      return reply(params, label, { issues, note: '모의 선택' });
    }
    if (label.startsWith('write:')) {
      const assign = JSON.parse(tagText(user, '배정'));
      if (opts.badWriteOnce?.(label) && n === 1) return reply(params, label, '이건 JSON이 아니에요');
      return reply(params, label, fixtureIssue(assign));
    }
    if (label.startsWith('repair:')) return reply(params, label, JSON.parse(tagText(user, '이슈')));
    if (label === 'verify:weekly') return reply(params, label, { ok: true, problems: [] });
    if (label.startsWith('verify:')) {
      const bad = opts.failVerify?.(label, n);
      return reply(params, label, bad ? { ok: false, problems: [{ field: 'points[0]', claim: '모의 문장', problem: '기사에서 확인되지 않아요', fix: '빼세요' }] } : { ok: true, problems: [] });
    }
    if (label.startsWith('news:')) {
      const ids = [...user.matchAll(/<기사 id="([^"]+)"/g)].map((m) => m[1]);
      return reply(params, label, { items: ids.map((id) => ({ article_id: id, kind: '상품', title: `모의 회사 소식 ${id.slice(-3)}`, text: '모의 요약이에요. 시험용 문장입니다.' })) });
    }
    if (label.startsWith('newsverify:')) {
      const ids = [...(tagText(user, '회사 소식') ? JSON.parse(tagText(user, '회사 소식')) : [])].map((x) => x.article_id);
      return reply(params, label, { results: ids.map((id) => ({ article_id: id, ok: true, problem: '' })) });
    }
    if (label.startsWith('lesson:')) {
      const t = JSON.parse(tagText(user, '용어')).t;
      if (opts.badLessonOnce?.(label) && n === 1) return reply(params, label, '이건 JSON이 아니에요');
      return reply(params, label, fixtureLesson(t));
    }
    if (label.startsWith('lessonverify:')) {
      const bad = opts.failLesson?.(label);
      return reply(params, label, bad ? { ok: false, problems: [{ field: 'example', claim: '모의 계산', problem: '계산이 맞지 않아요', fix: '다시 계산하세요' }] } : { ok: true, problems: [] });
    }
    if (label === 'weekly') {
      const m = user.match(/id:"(\d{4}-\d{2}-\d{2})", start:"(\d{4}-\d{2}-\d{2})"/);
      const threads = JSON.parse(tagText(user, '이어보기 id'));
      return reply(params, label, { id: m[1], start: m[2], end: m[1], title: '모의 한 주', big: ['이번 주는 모의 이슈가 이어졌어요.', '근거를 설명하는 일이 반복해서 나왔어요.'], flows: [{ thread: threads[0], note: '모의 흐름' }], takeaway: '근거를 함께 보세요.', next: '다음 주를 지켜보세요.' });
    }
    throw new Error('알 수 없는 모의 라벨: ' + label);
  };
}
