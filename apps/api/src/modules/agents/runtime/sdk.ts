// The only file that imports the AI SDK (Plan 2 §12): SDK renames between majors stay in one place.
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { APICallError, type LanguageModelV4 } from '@ai-sdk/provider';
import { generateText, isStepCount, tool, type LanguageModel } from 'ai';
import type { DramaAgentContext } from './context';
import type { ToolSpec } from './tool';

export type { LanguageModel, LanguageModelV4 };

/** Provider HTTP failures, with their status code. */
export const isApiCallError = (err: unknown): err is { statusCode?: number; message: string } => APICallError.isInstance(err);

type FetchFn = typeof fetch;

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
  let result;
  try {
    result = await generateText({
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
  } finally {
    await Promise.allSettled(inFlight);
  }
  const done = !!opts.isDone?.(toolCalls);
  return {
    text: result.text,
    steps: result.steps.length,
    toolCalls,
    finishReason: result.finishReason,
    stepLimitReached: !done && result.steps.length >= opts.maxSteps,
  };
}
