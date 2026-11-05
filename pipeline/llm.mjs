// 클로드 API 호출 한 곳으로 모으기: 예산 확인, 스트리밍, 거절/잘림 처리, 사용량과 비용 계산.
// 실제 통신은 transport(params, meta) 함수가 맡아요. 시험과 --mock에서는 가짜 transport를 넣어요.
import { MODELS, FALLBACK_BETA, modelInfo, costOf } from './config.mjs';
import { log } from './util.mjs';

export class BudgetExceededError extends Error {}
export class RefusalError extends Error {
  constructor(msg, category) { super(msg); this.category = category; }
}
export class TruncatedError extends Error {}
export class OutputParseError extends Error {}
// 계정, 권한, 결제, 모델 문제: 계속해도 소용없어서 실행 전체를 멈춰요
export class FatalApiError extends Error {}
// 한도 초과(재시도 끝), 서버 문제, 잘못된 요청: 그 항목만 포기해요
export class ApiItemError extends Error {}

// transport가 던지는 분류된 오류. kind: auth, permission, billing, notfound, badrequest, ratelimit, server, connection, beta
export class ApiFailure extends Error {
  constructor(kind, status, message) { super(message); this.kind = kind; this.status = status; }
}

// 글에서 JSON 객체를 꺼내요 (코드 울타리나 앞뒤 설명이 붙어도)
export function parseJsonText(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new OutputParseError('JSON 객체를 찾지 못했어요.');
  try {
    return JSON.parse(t.slice(a, b + 1));
  } catch (e) {
    throw new OutputParseError('JSON을 읽지 못했어요: ' + e.message);
  }
}

// 요청 본문 만들기. 모델에 따라 fallbacks와 베타 헤더를 붙이거나 빼요.
export function buildParams({ model, system, user, schema, effort, maxTokens, useFallback = true }) {
  const info = modelInfo(model);
  const params = {
    model,
    max_tokens: maxTokens,
    // 시스템 프롬프트 끝에 캐시 경계를 둬요 (GUIDE 전체가 들어 있어 이슈마다 다시 읽지 않아요)
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
    output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
    // 쓰지 않는 것: temperature, 미리 채우기, 강제 tool_choice, thinking 끄기 (이 모델들은 400을 돌려줘요)
  };
  if (info.fallback && useFallback) {
    params.fallbacks = 'default';
    params.betas = [FALLBACK_BETA];
  }
  return params;
}

export class LLMClient {
  constructor({ transport, budgetUsd = 0.8, onCall } = {}) {
    this.transport = transport;
    this.budgetUsd = budgetUsd;
    this.usage = new Map(); // 모델 -> { calls, input, output, cacheRead, cacheWrite, cost, refusals }
    this.noFallback = new Set(); // 베타 헤더가 거절된 모델
    this.onCall = onCall;
  }

  get spent() {
    let s = 0;
    for (const u of this.usage.values()) s += u.cost;
    return s;
  }

  _account(model, usage, refused) {
    const u = this.usage.get(model) || { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, refusals: 0 };
    const add = {
      input: usage?.input_tokens || 0,
      output: usage?.output_tokens || 0,
      cacheRead: usage?.cache_read_input_tokens || 0,
      cacheWrite: usage?.cache_creation_input_tokens || 0,
    };
    u.calls++;
    u.input += add.input; u.output += add.output; u.cacheRead += add.cacheRead; u.cacheWrite += add.cacheWrite;
    u.cost += costOf(model, add);
    if (refused) u.refusals++;
    this.usage.set(model, u);
  }

  // role: triage, select, write, repair, news, weekly, verify, lesson (effort를 정하는 데 써요)
  async call({ model, role, label, system, user, schema, maxTokens = 32000, json = true }) {
    modelInfo(model);
    if (this.spent >= this.budgetUsd) {
      throw new BudgetExceededError(`예산을 넘었어요 (${this.spent.toFixed(2)} / ${this.budgetUsd} 달러)`);
    }
    const effort = MODELS[model].effort[role];
    let message;
    for (let attempt = 0; ; attempt++) {
      const params = buildParams({ model, system, user, schema, effort, maxTokens, useFallback: !this.noFallback.has(model) });
      try {
        message = await this.transport(params, { label, role });
        break;
      } catch (err) {
        if (!(err instanceof ApiFailure)) throw err;
        if (['auth', 'permission', 'billing', 'notfound'].includes(err.kind)) {
          throw new FatalApiError(fatalMessage(err, model));
        }
        // 대체 모델 베타 헤더를 이 계정이 못 쓰면 fallbacks 없이 한 번 더
        if (err.kind === 'beta' && params.fallbacks && attempt === 0) {
          log(`  주의: ${model}은 대체 모델(fallbacks) 베타를 쓸 수 없어서 빼고 다시 보내요.`);
          this.noFallback.add(model);
          continue;
        }
        throw new ApiItemError(`${label}: API 오류(${err.kind}${err.status ? ' ' + err.status : ''}): ${err.message}`);
      }
    }
    const refused = message.stop_reason === 'refusal';
    this._account(model, message.usage, refused);
    this.onCall?.({ model, label, usage: message.usage });
    // 내용을 읽기 전에 stop_reason부터 확인
    if (refused) {
      throw new RefusalError(`${label}: 모델이 거절했어요 (${message.stop_details?.category ?? '분류 없음'})`, message.stop_details?.category ?? null);
    }
    if (message.stop_reason === 'max_tokens') throw new TruncatedError(`${label}: 출력이 max_tokens에서 잘렸어요.`);
    const text = (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { text, json: json ? parseJsonText(text) : null, model: message.model || model, stopReason: message.stop_reason };
  }
}

function fatalMessage(err, model) {
  const base = {
    auth: 'API 키가 올바르지 않아요. 저장소의 ANTHROPIC_API_KEY 비밀값을 확인해주세요.',
    permission: '이 키로는 이 작업을 할 수 없어요. 키의 조직과 작업공간 권한을 확인해주세요.',
    billing: 'API 결제 문제예요(크레딧이 부족하거나 결제 설정 문제). 콘솔의 결제 화면을 확인해주세요.',
    notfound: `모델 ${model}을 찾을 수 없거나 이 조직에서 쓸 수 없어요. 모델 이름을 확인해주세요.`,
  }[err.kind];
  return `${base} (HTTP ${err.status ?? '?'}: ${err.message})`;
}

// 실제 SDK transport. SDK는 필요할 때만 불러와요 (--mock과 시험에서는 설치가 없어도 돼요).
export async function createRealTransport() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ maxRetries: 5, timeout: 15 * 60 * 1000 }); // 429, 5xx는 SDK가 알아서 다시 시도해요
  const classify = (e) => {
    if (e instanceof Anthropic.AuthenticationError) return 'auth';
    if (e instanceof Anthropic.PermissionDeniedError) return 'permission';
    if (e instanceof Anthropic.NotFoundError) return 'notfound';
    if (e instanceof Anthropic.RateLimitError) return 'ratelimit';
    if (e instanceof Anthropic.BadRequestError) {
      const m = String(e.message);
      if (/anthropic-beta/i.test(m)) return 'beta';
      if (/credit balance|billing/i.test(m)) return 'billing'; // 크레딧 부족은 400으로 오기도 해요
      return 'badrequest';
    }
    if (e instanceof Anthropic.APIError) {
      if (e.status === 402) return 'billing';
      if (typeof e.status === 'number' && e.status >= 500) return 'server';
      return e instanceof Anthropic.APIConnectionError ? 'connection' : 'badrequest';
    }
    return null;
  };
  return async (params) => {
    try {
      const { betas, ...body } = params;
      const stream = client.beta.messages.stream({ ...body, ...(betas ? { betas } : {}) });
      return await stream.finalMessage();
    } catch (e) {
      const kind = classify(e);
      if (kind) throw new ApiFailure(kind, e.status, e.message);
      throw e;
    }
  };
}
