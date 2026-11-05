// 모델별 가격, 기능, 작업별 노력 수준(effort). 가격은 100만 토큰당 달러예요.
export const DEFAULT_WRITER_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_VERIFIER_MODEL = 'claude-opus-5-5';

// effort는 모델 문서(shared/model-migration.md)의 권장에 따라 정했어요.
//  - 글쓰기: 소넷은 콘텐츠 생성이 low 권장이지만, 지켜야 할 규칙이 많은 긴 글이라 medium으로 해요.
//  - 검토: 팩트 검증이라 high.
export const MODELS = {
  'claude-sonnet-5-5': {
    tiers: [{ upTo: Infinity, in: 2, out: 10, read: 0.2, write: 2.5 }],
    fallback: true, // 서버 쪽 거절 대체(fallbacks) 지원
    effort: { select: 'medium', write: 'medium', repair: 'medium', news: 'low', weekly: 'medium', verify: 'high' },
  },
  'claude-opus-5-5': {
    tiers: [{ upTo: Infinity, in: 4, out: 20, read: 0.2, write: 5 }],
    fallback: true,
    effort: { select: 'medium', write: 'medium', repair: 'medium', news: 'low', weekly: 'medium', verify: 'high' },
  },
  // 하이쿠: 프롬프트가 10만 토큰 이하면 싼 쪽 요금, 넘으면 비싼 쪽. 서버 쪽 대체 없음(fallbacks를 보내면 안 돼요).
  'claude-haiku-5-5': {
    tiers: [
      { upTo: 100000, in: 0.1, out: 0.5, read: 0.01, write: 0.125 },
      { upTo: Infinity, in: 0.5, out: 2.5, read: 0.05, write: 0.625 },
    ],
    fallback: false,
    effort: { select: 'high', write: 'high', repair: 'high', news: 'medium', weekly: 'high', verify: 'high' },
  },
};

export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'; // fallbacks: "default" 형태의 베타 헤더

export function modelInfo(model) {
  const m = MODELS[model];
  if (!m) throw new Error(`알 수 없는 모델이에요: ${model} (가격표에 있는 모델: ${Object.keys(MODELS).join(', ')})`);
  return m;
}

// 호출 한 번의 예상 비용(달러). 프롬프트 길이(입력+캐시)로 요금표를 골라요.
export function costOf(model, u) {
  const info = modelInfo(model);
  const prompt = (u.input || 0) + (u.cacheRead || 0) + (u.cacheWrite || 0);
  const t = info.tiers.find((x) => prompt <= x.upTo);
  return ((u.input || 0) * t.in + (u.output || 0) * t.out + (u.cacheRead || 0) * t.read + (u.cacheWrite || 0) * t.write) / 1e6;
}
