import { env } from '../../../env';
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

/** How many results the run has had from one tool. */
const resultCount = (options: CallOptions, tool: string) =>
  options.prompt.flatMap((m) => (m.role === 'tool' ? m.content : [])).filter((p) => p.type === 'tool-result' && p.toolName === tool).length;

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

/** The story's first sentences, headings dropped, as a placeholder recap labelled with the episode number. */
function stubRecap(episodeNumber: number, script: string): string {
  const sentences = script
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p && !p.startsWith('#'))
    .join(' ')
    .split(/(?<=[.!?。！？])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  let text = `Episode ${episodeNumber}:`;
  for (const s of sentences) {
    if (`${text} ${s}`.length > 600) break;
    text += ` ${s}`;
  }
  return sentences.length > 0 ? text : `${text} nothing happens yet; the script is still empty.`;
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

interface ContextAsset {
  id: number;
  name?: string;
  location?: string;
}

/** One timed line per sub-shot, spreading the shot's length over them ("0-4s: …"). */
function timedLines(blocks: string[], seconds: number): string[] {
  const span = seconds / blocks.length;
  return blocks.map((b, i) => `${Math.round(i * span)}-${Math.round((i + 1) * span)}s: ${b.slice(0, 160)}`);
}

/**
 * Splits a script into story paragraphs (headings dropped) and groups them into shots. Without a target length a shot
 * holds up to three paragraphs; with one, the paragraphs are spread over as many 8-15 s shots as fit it.
 */
function stubShots(script: string, target: number | null, chars: ContextAsset[], scenesList: ContextAsset[], propsList: ContextAsset[]): Json[] {
  const paragraphs = script
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p && !p.startsWith('#'));
  const natural = Math.max(1, Math.ceil(paragraphs.length / 3));
  const count = target ? Math.max(Math.ceil(target / 15), Math.min(natural, Math.floor(target / 8)), 1) : natural;
  const groups = Array.from({ length: count }, (_, i) =>
    paragraphs.slice(Math.floor((i * paragraphs.length) / count), Math.floor(((i + 1) * paragraphs.length) / count)),
  ).map((g) => (g.length > 0 ? g : ['The moment holds.']));
  const scene = scenesList[0];
  return groups.map((group, index) => {
    const text = group.join(' ');
    const seen = chars.filter((c) => c.name && text.includes(c.name));
    const shown = propsList.filter((p) => p.name && text.toLowerCase().includes(p.name.toLowerCase()));
    const seconds = target ? Math.floor(target / count) + (index < target % count ? 1 : 0) : Math.min(15, Math.max(8, group.length * 4));
    const header = [...seen.map((c) => `@[${c.name}]`), ...shown.map((p) => `@[${p.name}]`)].join(' and ');
    return {
      shotNumber: index + 1,
      title: text.split(' ').slice(0, 6).join(' '),
      durationSeconds: seconds,
      shotType: 'medium',
      angle: 'eye level',
      movement: 'static',
      sceneId: scene?.id,
      characterIds: seen.map((c) => c.id),
      propIds: shown.map((p) => p.id),
      description: group.map((p, i) => `[Shot ${i + 1}] ${p}`).join('\n'),
      atmosphere: 'natural light, quiet ambience',
      videoPrompt: [`${header || 'The scene'}${scene?.location ? ` at @[${scene.location}]` : ''}.`, ...timedLines(group, seconds)].join('\n'),
    };
  });
}

/** A video prompt from a shot's context: header of mentionable names, then one timed line per sub-shot. */
function stubVideoPrompt(read: { shot?: Json; mentionable?: { scene?: string | null; characters?: string[]; props?: string[] } } | null): string {
  const shot = read?.shot ?? {};
  const m = read?.mentionable ?? {};
  const names = [...(m.characters ?? []), ...(m.props ?? [])].map((n) => `@[${n}]`).join(' and ');
  const header = `${names || 'The scene'}${m.scene ? ` at @[${m.scene}]` : ''}.`;
  const blocks = String(shot.description ?? '')
    .split(/\[Shot \d+\]/)
    .map((b) => b.trim())
    .filter(Boolean);
  const seconds = Number(shot.durationSeconds) || 3 * Math.max(1, blocks.length);
  return [header, ...timedLines(blocks.length ? blocks : [String(shot.title ?? 'The shot plays out.')], seconds)].join('\n');
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

  if (tools.has('save_recap')) {
    if (!done.has('read_episode_for_recap')) return next('read_episode_for_recap');
    if (!done.has('save_recap')) {
      const read = done.get('read_episode_for_recap') as { episodeNumber?: number; script?: string } | null;
      return next('save_recap', { recap: stubRecap(read?.episodeNumber ?? 0, read?.script ?? '') });
    }
    return { text: 'Saved the recap.' };
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

  if (tools.has('save_shots')) {
    if (!done.has('read_storyboard_context')) return next('read_storyboard_context');
    const ctx = (done.get('read_storyboard_context') ?? {}) as {
      script?: string;
      targetDurationSeconds?: number | null;
      characters?: ContextAsset[];
      scenes?: ContextAsset[];
      props?: ContextAsset[];
    };
    const shots = stubShots(ctx.script ?? '', ctx.targetDurationSeconds ?? null, ctx.characters ?? [], ctx.scenes ?? [], ctx.props ?? []);
    const batch = resultCount(options, 'save_shots');
    if (batch * 8 < shots.length) {
      // A script containing #partial never marks its last batch, to exercise the unfinished-breakdown path.
      const last = (batch + 1) * 8 >= shots.length && !(ctx.script ?? '').includes('#partial');
      return next('save_shots', { replaceExisting: batch === 0, final: last, shots: shots.slice(batch * 8, batch * 8 + 8) });
    }
    return { text: 'Saved the storyboard.' };
  }

  if (tools.has('update_shot') && /\bvideo prompt\b/i.test(message)) {
    const id = firstId(message);
    if (!done.has('read_storyboard_context')) return next('read_storyboard_context', { shotId: id });
    if (!done.has('update_shot')) {
      const read = done.get('read_storyboard_context') as Parameters<typeof stubVideoPrompt>[0];
      return next('update_shot', { shotId: id, videoPrompt: stubVideoPrompt(read) });
    }
    return { text: 'Saved the video prompt.' };
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
      if (env.OPEN_DRAMA_STUB_DELAY_MS > 0) await new Promise((r) => setTimeout(r, env.OPEN_DRAMA_STUB_DELAY_MS));
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
