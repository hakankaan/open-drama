// The only file that imports the AI SDK (Plan 2 §12): SDK renames between majors stay in one place.
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { APICallError, type LanguageModelV4 } from '@ai-sdk/provider';
import { generateText, isStepCount, tool, type LanguageModel } from 'ai';
import type { AgentContext } from './context';
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
}

/** One tool-calling loop: instructions, one user message, the agent's tools, a step budget. */
export async function runToolLoop(opts: {
  model: LanguageModel;
  instructions: string;
  message: string;
  tools: ToolSpec[];
  ctx: AgentContext;
  maxSteps: number;
  temperature?: number;
  abortSignal?: AbortSignal;
  stopAfterTool?: string;
}): Promise<RunLoopResult> {
  const toolCalls: ToolCallRecord[] = [];
  const tools = Object.fromEntries(
    opts.tools.map((spec) => [
      spec.id,
      tool({
        description: spec.description,
        inputSchema: spec.input,
        execute: async (input: unknown) => {
          const started = performance.now();
          try {
            const result = await spec.execute(input, opts.ctx);
            const ok = !(result && typeof result === 'object' && 'error' in result);
            toolCalls.push({ tool: spec.id, ok });
            opts.ctx.log.info({ tool: spec.id, ok, ms: Math.round(performance.now() - started) }, 'tool call');
            return result;
          } catch (err) {
            toolCalls.push({ tool: spec.id, ok: false });
            opts.ctx.log.warn({ tool: spec.id, err: (err as Error).message }, 'tool call failed');
            return { error: (err as Error).message };
          }
        },
      }),
    ]),
  );
  const result = await generateText({
    model: opts.model,
    instructions: opts.instructions,
    prompt: opts.message,
    tools,
    // Stop at the step budget, or right after the save tool succeeded: a trailing "saved" turn adds nothing
    // and its failure must not fail a run whose result is already persisted.
    stopWhen: [
      isStepCount(opts.maxSteps),
      () => !!opts.stopAfterTool && toolCalls.some((c) => c.tool === opts.stopAfterTool && c.ok),
    ],
    temperature: opts.temperature,
    abortSignal: opts.abortSignal,
  });
  return { text: result.text, steps: result.steps.length, toolCalls };
}
