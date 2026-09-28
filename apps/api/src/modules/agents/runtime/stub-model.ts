import type { LanguageModelV4 } from './sdk';

/**
 * Offline text model for OPEN_DRAMA_STUB_PROVIDERS=1 (Plan 2 goal 6). It drives the real tool loop with scripted,
 * deterministic tool calls chosen from the tools the agent offers, so every agent path (read, save, retry, job
 * outcome) runs without a provider. Its output is placeholder text, not a writing model.
 */

type CallOptions = Parameters<LanguageModelV4['doGenerate']>[0];
type Json = Record<string, unknown>;

interface Step {
  tool?: string;
  input?: Json;
  text?: string;
}

/** Tool results seen so far in the conversation, by tool name (latest wins). */
function toolResults(options: CallOptions): Map<string, unknown> {
  const results = new Map<string, unknown>();
  for (const message of options.prompt) {
    if (message.role !== 'tool') continue;
    for (const part of message.content) {
      if (part.type !== 'tool-result') continue;
      const out = part.output;
      results.set(part.toolName, out.type === 'json' ? out.value : out.type === 'text' ? out.value : null);
    }
  }
  return results;
}

function userText(options: CallOptions): string {
  return options.prompt
    .filter((m) => m.role === 'user')
    .flatMap((m) => m.content)
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('\n');
}

const STOPWORDS = new Set(
  'The A An And But Or So Then When While After Before She He They It Its His Her Their We You I In On At Of To For With From By Into Under Over Rain Night Day Morning Evening Int Ext Scene Main Location This That There Here One Two Three'.split(
    ' ',
  ),
);

/** Formats raw content as a minimal script: one scene heading, then one paragraph per sentence. */
function stubScript(content: string): string {
  const sentences = content
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return ['## S01 | INT Main location | Day', '', ...sentences.flatMap((s) => [s, ''])].join('\n').trim();
}

function stubCharacters(script: string, existing: string[]): Json[] {
  const counts = new Map<string, number>();
  for (const match of script.matchAll(/\b[A-Z][a-z]{2,}\b/g)) {
    if (!STOPWORDS.has(match[0])) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  for (const match of script.matchAll(/^([A-Z][A-Z ]{1,30}) \(/gm)) {
    const name = match[1]!.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    counts.set(name, (counts.get(name) ?? 0) + 2);
  }
  const names = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => existing.find((e) => e.toLowerCase() === name.toLowerCase()) ?? name);
  return names.map((name) => ({
    name,
    role: 'character',
    appearance: `${name}, as described in the script`,
    styling: 'everyday clothes suited to the scene',
  }));
}

function stubScenes(script: string): Json[] {
  const scenes = [...script.matchAll(/^##\s*S\d+\s*\|\s*(?:INT|EXT)?\.?\s*([^|]+?)\s*\|\s*(.+)$/gm)].map((m) => ({
    location: m[1]!.trim(),
    time: m[2]!.trim(),
  }));
  const unique = scenes.filter((s, i) => scenes.findIndex((o) => o.location === s.location && o.time === s.time) === i);
  return (unique.length > 0 ? unique : [{ location: 'Main location', time: 'Day' }]).map((s) => ({
    ...s,
    prompt: `${s.location}, furnished as the script describes`,
    lighting: 'natural light for the time of day',
  }));
}

const firstId = (text: string) => Number(/\(id (\d+)\)/.exec(text)?.[1] ?? /\bid[:= ]+(\d+)/i.exec(text)?.[1] ?? 0);

function plan(options: CallOptions): Step {
  const tools = new Set((options.tools ?? []).map((t) => t.name));
  const done = toolResults(options);
  const message = userText(options);
  const next = (tool: string, input: Json = {}): Step => ({ tool, input });

  if (tools.has('save_script')) {
    if (!done.has('read_episode_script')) return next('read_episode_script');
    if (!done.has('save_script')) {
      const read = done.get('read_episode_script') as { content?: string } | null;
      return next('save_script', { content: stubScript(read?.content ?? '') });
    }
    return { text: 'Saved the script.' };
  }

  if (tools.has('save_dedup_characters')) {
    const target = /\bscenes\b/i.test(message) ? 'scenes' : /\bprops\b/i.test(message) ? 'props' : 'characters';
    if (!done.has('read_script_for_extraction')) return next('read_script_for_extraction');
    if (!done.has(`read_existing_${target}`)) return next(`read_existing_${target}`);
    if (!done.has(`save_dedup_${target}`)) {
      const script = String((done.get('read_script_for_extraction') as { script?: string } | null)?.script ?? '');
      const existing = ((done.get(`read_existing_${target}`) as { items?: { name?: string }[] } | null)?.items ?? [])
        .map((i) => i.name ?? '')
        .filter(Boolean);
      const items = target === 'characters' ? stubCharacters(script, existing) : target === 'scenes' ? stubScenes(script) : [];
      return next(`save_dedup_${target}`, { items });
    }
    return { text: `Saved the ${target}.` };
  }

  for (const kind of ['character', 'scene', 'prop'] as const) {
    const save = `save_${kind}_final_prompt`;
    if (!tools.has(save) || !new RegExp(`\\b${kind}\\b`, 'i').test(message)) continue;
    const read = `read_${kind}s`;
    const id = firstId(message);
    if (!done.has(read)) return next(read, { ids: [id] });
    if (!done.has(save)) {
      const item = ((done.get(read) as { items?: Json[] } | null)?.items ?? [])[0] ?? {};
      const fields = Object.entries(item)
        .filter(([k, v]) => typeof v === 'string' && v && !['finalPrompt'].includes(k))
        .map(([, v]) => v)
        .join(', ');
      const lead =
        kind === 'character'
          ? 'Character turnaround sheet, portrait and full body front, side and back'
          : kind === 'scene'
            ? 'Wide establishing view of an empty place, no people'
            : 'Product shot of a single object on a plain neutral background';
      return next(save, { [`${kind}Id`]: id, prompt: `${lead}: ${fields}.` });
    }
    return { text: 'Saved the prompt.' };
  }

  return { text: 'Nothing to do.' };
}

let counter = 0;

export function stubLanguageModel(): LanguageModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'stub',
    modelId: 'stub-text',
    supportedUrls: {},
    async doGenerate(options) {
      const step = plan(options);
      const usage = {
        inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 0, text: 0, reasoning: undefined },
      };
      if (step.tool) {
        return {
          content: [
            { type: 'tool-call', toolCallId: `stub-${++counter}`, toolName: step.tool, input: JSON.stringify(step.input ?? {}) },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage,
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text', text: step.text ?? '' }],
        finishReason: { unified: 'stop', raw: undefined },
        usage,
        warnings: [],
      };
    },
    doStream() {
      throw new Error('The stub text model does not stream');
    },
  };
}
