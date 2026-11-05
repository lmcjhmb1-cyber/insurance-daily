import test from 'node:test';
import assert from 'node:assert/strict';
import { LLMClient, buildParams, ApiFailure, BudgetExceededError, RefusalError, TruncatedError, FatalApiError, ApiItemError, OutputParseError } from '../llm.mjs';
import { costOf, FALLBACK_BETA } from '../config.mjs';

const msg = (text, extra = {}) => ({ model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1000, output_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, ...extra });
const call = (llm, over = {}) => llm.call({ model: 'claude-sonnet-5-5', role: 'write', label: 't', system: 'S', user: 'U', ...over });

test('요청 본문: 모델별 fallbacks, effort, 캐시 경계, 금지된 값 없음', () => {
  for (const [model, fb] of [['claude-sonnet-5-5', true], ['claude-opus-5-5', true], ['claude-haiku-5-5', false]]) {
    const p = buildParams({ model, system: 'S', user: 'U', effort: 'low', maxTokens: 100 });
    assert.equal(p.fallbacks === 'default', fb, model);
    assert.deepEqual(p.betas, fb ? [FALLBACK_BETA] : undefined, model);
    assert.equal(p.output_config.effort, 'low');
    assert.deepEqual(p.system[0].cache_control, { type: 'ephemeral' });
    for (const k of ['temperature', 'top_p', 'top_k', 'thinking', 'tool_choice']) assert.ok(!(k in p), k);
    assert.equal(p.messages.at(-1).role, 'user', '미리 채우기 없음');
  }
  const p = buildParams({ model: 'claude-opus-5-5', system: 'S', user: 'U', effort: 'high', maxTokens: 1, schema: { type: 'object' } });
  assert.equal(p.output_config.format.type, 'json_schema');
});

test('역할별 effort는 모델 표에서 온다', async () => {
  const seen = [];
  const llm = new LLMClient({ transport: async (p) => { seen.push([p.model, p.output_config.effort]); return msg('{}'); } });
  await call(llm, { role: 'verify', model: 'claude-opus-5-5' });
  await call(llm, { role: 'write', model: 'claude-haiku-5-5' });
  assert.deepEqual(seen, [['claude-opus-5-5', 'high'], ['claude-haiku-5-5', 'high']]);
});

test('비용: 소넷, 오푸스, 하이쿠 두 요금 구간', () => {
  const u = { input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite: 1e6 };
  assert.ok(Math.abs(costOf('claude-sonnet-5-5', u) - (2 + 10 + 0.2 + 2.5)) < 1e-9);
  assert.ok(Math.abs(costOf('claude-opus-5-5', u) - (4 + 20 + 0.2 + 5)) < 1e-9);
  const small = { input: 50000, output: 10000, cacheRead: 0, cacheWrite: 0 };
  assert.ok(Math.abs(costOf('claude-haiku-5-5', small) - (50000 * 0.1 + 10000 * 0.5) / 1e6) < 1e-12);
  const big = { input: 150000, output: 10000, cacheRead: 0, cacheWrite: 0 };
  assert.ok(Math.abs(costOf('claude-haiku-5-5', big) - (150000 * 0.5 + 10000 * 2.5) / 1e6) < 1e-12);
  assert.throws(() => costOf('claude-unknown', u), /알 수 없는 모델/);
});

test('사용량을 모델별로 합산한다', async () => {
  const llm = new LLMClient({ transport: async () => msg('{"a":1}', { usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 } }) });
  await call(llm); await call(llm);
  const u = llm.usage.get('claude-sonnet-5-5');
  assert.deepEqual([u.calls, u.input, u.output, u.cacheRead, u.cacheWrite], [2, 20, 40, 60, 80]);
  assert.ok(llm.spent > 0);
});

test('예산을 넘으면 새 호출을 시작하지 않는다', async () => {
  let n = 0;
  const llm = new LLMClient({ budgetUsd: 0.001, transport: async () => { n++; return msg('{}', { usage: { input_tokens: 1e6, output_tokens: 0 } }); } });
  await call(llm); // 이 호출로 예산을 넘음
  await assert.rejects(() => call(llm), BudgetExceededError);
  assert.equal(n, 1);
});

test('거절(refusal)은 내용을 읽지 않고 오류로, 비용과 거절 횟수는 기록한다', async () => {
  const llm = new LLMClient({ transport: async () => msg('{"x":1}', { stop_reason: 'refusal', stop_details: { category: 'cyber' } }) });
  await assert.rejects(() => call(llm), (e) => e instanceof RefusalError && e.category === 'cyber');
  assert.equal(llm.usage.get('claude-sonnet-5-5').refusals, 1);
});

test('max_tokens로 잘리면 오류, JSON이 아니면 읽기 오류', async () => {
  await assert.rejects(() => call(new LLMClient({ transport: async () => msg('{"a":', { stop_reason: 'max_tokens' }) })), TruncatedError);
  await assert.rejects(() => call(new LLMClient({ transport: async () => msg('JSON 아님') })), OutputParseError);
  const ok = await call(new LLMClient({ transport: async () => msg('```json\n{"a":1}\n```') }));
  assert.deepEqual(ok.json, { a: 1 });
});

test('인증, 결제, 모델 오류는 실행 전체를 멈추는 오류로, 서버 오류는 그 항목만', async () => {
  for (const kind of ['auth', 'permission', 'billing', 'notfound']) {
    const llm = new LLMClient({ transport: async () => { throw new ApiFailure(kind, 401, 'x'); } });
    await assert.rejects(() => call(llm), (e) => e instanceof FatalApiError && /[가-힣]/.test(e.message), kind);
  }
  const llm = new LLMClient({ transport: async () => { throw new ApiFailure('server', 529, 'overloaded'); } });
  await assert.rejects(() => call(llm), ApiItemError);
});

test('대체 모델 베타를 못 쓰면 fallbacks를 빼고 한 번 다시 보낸다 (하이쿠는 애초에 안 보냄)', async () => {
  const sent = [];
  const llm = new LLMClient({ transport: async (p) => { sent.push(!!p.fallbacks); if (p.fallbacks) throw new ApiFailure('beta', 400, 'Unexpected value(s) for the anthropic-beta header'); return msg('{}'); } });
  await call(llm);
  await call(llm); // 이후 호출은 처음부터 빼고 보냄
  assert.deepEqual(sent, [true, false, false]);
});
