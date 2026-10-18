// The only file that imports the AI SDK (Plan 2 §12): SDK renames between majors stay in one place.
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { APICallError, type LanguageModelV4 } from '@ai-sdk/provider';
import { isStepCount, simulateStreamingMiddleware, streamText, tool, wrapLanguageModel, type LanguageModel } from 'ai';
import type { DramaAgentContext } from './context';
import type { ToolSpec } from './tool';

export type { LanguageModel, LanguageModelV4 };

/** Provider HTTP failures, with their status code. */
export const isApiCallError = (err: unknown): err is { statusCode?: number; message: string } => APICallError.isInstance(err);

type FetchFn = typeof fetch;

/** Serves a generate-only model (the offline stub) to the streaming tool loop. */
export const simulateStreaming = (model: LanguageModelV4): LanguageModelV4 =>
  wrapLanguageModel({ model, middleware: simulateStreamingMiddleware() });

export function buildLanguageModel(opts: {
  provider: string;
  baseURL: string;
  apiKey: string;
  modelId: string;
  fetch: FetchFn;
}): LanguageModel {
  switch (opts.provider) {
    case 'openai':
      return createOpenAI({ baseURL: opts.baseURL, apiKey: opts.apiKey, fetch: opts.fetch }).chat(opts.modelId);
    case 'gemini':
      return createGoogle({ baseURL: opts.baseURL, apiKey: opts.apiKey, fetch: opts.fetch })(opts.modelId);
    default:
      return createOpenAICompatible({
        name: opts.provider,
        baseURL: opts.baseURL,
        apiKey: opts.apiKey,
        fetch: opts.fetch,
      }).chatModel(opts.modelId);
  }
}

export interface ToolCallRecord {
  tool: string;
  ok: boolean;
}

export interface RunLoopResult {
  text: string;
  steps: number;
  toolCalls: ToolCallRecord[];
  /** Why the last step ended: `length` means the answer hit the output-token limit. */
  finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other';
  /** The loop stopped because the step budget ran out, not because the result was saved. */
  stepLimitReached: boolean;
  /** Thinking tokens across the run, when the provider reports them. */
  reasoningTokens?: number;
}

/**
 * Every call streams, so a long thinking step stays within a relay's limit on unstreamed requests (ModelRunner's is
 * 95 s). streamText reports a provider failure to onError instead of throwing; the first one is rethrown here, once
 * the stream has ended, so a call fails as it would unstreamed.
 */
async function streamToEnd(options: Parameters<typeof streamText>[0]) {
  let failure: { error: unknown } | undefined;
  const result = streamText({
    ...options,
    onError: ({ error }) => {
      failure ??= { error };
    },
  });
  await result.consumeStream();
  options.abortSignal?.throwIfAborted();
  if (failure) throw failure.error;
  return result;
}

/** One tool-calling loop: instructions, one user message, the agent's tools, a step budget. */
export async function runToolLoop(opts: {
  model: LanguageModel;
  instructions: string;
  message: string;
  tools: ToolSpec[];
  ctx: DramaAgentContext;
  maxSteps: number;
  temperature?: number;
  /** Stops the loop at the next provider call or tool call (a cancelled job). */
  abortSignal?: AbortSignal;
  /** The longest one provider call may take. */
  stepTimeoutMs?: number;
  /** Ends the loop as soon as this holds (the result is already saved). */
  isDone?: (calls: ToolCallRecord[]) => boolean;
}): Promise<RunLoopResult> {
  const toolCalls: ToolCallRecord[] = [];
  // Tool calls still running when the loop throws: awaited, so none writes after the caller (a job) has settled.
  const inFlight = new Set<Promise<unknown>>();
  const tools = Object.fromEntries(
    opts.tools.map((spec) => [
      spec.id,
      tool({
        description: spec.description,
        inputSchema: spec.input,
        execute: (input: unknown) => {
          // Once the run is stopped no tool starts, so nothing is saved after a cancel.
          if (opts.abortSignal?.aborted) return { error: 'This run was stopped' };
          const call = runTool(spec, input);
          inFlight.add(call);
          void call.finally(() => inFlight.delete(call));
          return call;
        },
      }),
    ]),
  );
  async function runTool(spec: ToolSpec, input: unknown) {
    const started = performance.now();
    try {
      const result = await spec.execute(input, opts.ctx);
      // A refusal is a returned { error } the model is expected to act on; its reason goes to the log too.
      const reason = result && typeof result === 'object' && 'error' in result ? String((result as { error: unknown }).error) : undefined;
      const ok = reason === undefined;
      toolCalls.push({ tool: spec.id, ok });
      opts.ctx.log.info({ tool: spec.id, ok, ...(ok ? {} : { reason }), ms: Math.round(performance.now() - started) }, 'tool call');
      return result;
    } catch (err) {
      toolCalls.push({ tool: spec.id, ok: false });
      opts.ctx.log.warn({ tool: spec.id, err: (err as Error).message }, 'tool call failed');
      return { error: (err as Error).message };
    }
  }
  try {
    const result = await streamToEnd({
      model: opts.model,
      instructions: opts.instructions,
      prompt: opts.message,
      tools,
      // Stop at the step budget, or as soon as the result is saved: a trailing "saved" turn adds nothing and its
      // failure must not fail a run whose result is already persisted.
      stopWhen: [isStepCount(opts.maxSteps), () => !!opts.isDone?.(toolCalls)],
      temperature: opts.temperature,
      abortSignal: opts.abortSignal,
      timeout: opts.stepTimeoutMs === undefined ? undefined : { stepMs: opts.stepTimeoutMs },
    });
    const [text, steps, finishReason, usage] = await Promise.all([result.text, result.steps, result.finishReason, result.totalUsage]);
    const done = !!opts.isDone?.(toolCalls);
    return {
      text,
      steps: steps.length,
      toolCalls,
      finishReason,
      stepLimitReached: !done && steps.length >= opts.maxSteps,
      reasoningTokens: usage.outputTokenDetails.reasoningTokens,
    };
  } finally {
    await Promise.allSettled(inFlight);
  }
}

/** One question about some images, answered in text: no tools, one call (shot checks, adr-0022). */
export async function askAboutImages(opts: {
  model: LanguageModel;
  instructions: string;
  text: string;
  /** JPEG bytes, in the order the text names them. */
  images: Uint8Array[];
  temperature?: number;
  timeoutMs: number;
}): Promise<{ text: string; finishReason: RunLoopResult['finishReason'] }> {
  const result = await streamToEnd({
    model: opts.model,
    instructions: opts.instructions,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: opts.text }, ...opts.images.map((image) => ({ type: 'image' as const, image, mediaType: 'image/jpeg' }))],
      },
    ],
    temperature: opts.temperature,
    abortSignal: AbortSignal.timeout(opts.timeoutMs),
  });
  const [text, finishReason] = await Promise.all([result.text, result.finishReason]);
  return { text, finishReason };
}
