import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { isNarrator, SHOT_DURATION_MAX, SHOT_DURATION_MIN } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { characters, episodeCharacters, episodeProps, episodeScenes, episodes, props, scenes } from '../../../db/schema';
import { seriesContext } from '../../production/series';
import { getShotRow, liveShotRows, loadBindings, saveShots, writeShotUpdate } from '../../storyboard/service';
import { defineTool } from '../runtime/tool';
import type { TargetFit } from '../services/video-model';

/** Models sometimes write the words "null" or "undefined" for a field they mean to leave alone. */
const GARBAGE = /^(null|undefined|none|n\/a)$/i;
const clean = <T extends Record<string, unknown>>(input: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined && v !== null && !(typeof v === 'string' && GARBAGE.test(v.trim()))),
  ) as Partial<T>;

const linked = <T extends { id: number }>(rows: T[], links: { id: number }[]) => {
  const ids = new Set(links.map((l) => l.id));
  return rows.map((r) => ({ ...r, inEpisode: ids.has(r.id) }));
};

/**
 * read_storyboard_context: without shotId, the script, the drama's assets with their ids and the current shots;
 * with shotId, that one shot with the names of its bound assets (what a video prompt may mention).
 */
export const readStoryboardContext = defineTool({
  id: 'read_storyboard_context',
  description:
    "Without shotId: the episode's script, its target length in seconds (null: follow the script), a `series` block (the project's premise and, for a serial drama, the earlier episodes' recaps), the project's characters, scenes and props with their ids, and the current shots with their total length. With shotId: that shot's description, atmosphere, duration and bound asset names.",
  input: z.object({ shotId: z.number().int().optional().describe('Read one shot of this episode') }),
  execute: ({ shotId }, ctx) => {
    if (shotId !== undefined) {
      const shot = getShotRow(shotId);
      if (shot.episodeId !== ctx.episodeId) return { error: `Shot ${shotId} is not in this episode` };
      const b = loadBindings([shot]).get(shot.id)!;
      return {
        shot: {
          shotId: shot.id,
          shotNumber: shot.shotNumber,
          title: shot.title,
          durationSeconds: shot.durationSeconds,
          shotType: shot.shotType,
          angle: shot.angle,
          movement: shot.movement,
          description: shot.description,
          atmosphere: shot.atmosphere,
          currentVideoPrompt: shot.videoPrompt,
        },
        mentionable: { scene: b.scene?.name ?? null, characters: b.characters.map((c) => c.name), props: b.props.map((p) => p.name) },
      };
    }
    const ep = db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).get();
    if (!ep) return { error: 'Episode not found' };
    const live = <T extends typeof characters | typeof scenes | typeof props>(t: T) =>
      and(eq(t.dramaId, ctx.dramaId), isNull(t.deletedAt));
    const chars = db
      .select({ id: characters.id, name: characters.name, role: characters.role, appearance: characters.appearance })
      .from(characters)
      .where(live(characters))
      .all()
      .filter((c) => !isNarrator(c.name, c.role));
    const scs = db.select({ id: scenes.id, location: scenes.location, time: scenes.time }).from(scenes).where(live(scenes)).all();
    const prs = db.select({ id: props.id, name: props.name, description: props.description }).from(props).where(live(props)).all();
    const linkedChars = db.select({ id: episodeCharacters.characterId }).from(episodeCharacters).where(eq(episodeCharacters.episodeId, ctx.episodeId)).all();
    const linkedScenes = db.select({ id: episodeScenes.sceneId }).from(episodeScenes).where(eq(episodeScenes.episodeId, ctx.episodeId)).all();
    const linkedProps = db.select({ id: episodeProps.propId }).from(episodeProps).where(eq(episodeProps.episodeId, ctx.episodeId)).all();
    return {
      episodeNumber: ep.episodeNumber,
      // A breakdown keeps the length it started with, even when the creator changes it meanwhile.
      targetDurationSeconds: ctx.jobId && targets.has(ctx.jobId) ? (targets.get(ctx.jobId)?.seconds ?? null) : ep.targetDurationSeconds,
      series: seriesContext(ctx.dramaId, ctx.episodeId, ctx.log),
      script: ep.scriptContent?.trim() || ep.content,
      characters: linked(chars, linkedChars),
      scenes: linked(scs, linkedScenes),
      props: linked(prs, linkedProps),
      shotsTotalSeconds: ep.durationSeconds,
      shots: liveShotRows(ctx.episodeId).map((s) => ({
        shotId: s.id,
        shotNumber: s.shotNumber,
        title: s.title,
        durationSeconds: s.durationSeconds,
        hasVideoPrompt: s.videoPrompt.trim().length > 0,
      })),
    };
  },
});

const text = (max: number) => z.string().max(max).optional();
const ShotFields = {
  title: text(200),
  shotType: text(60).describe('Dominant framing, e.g. "medium"'),
  angle: text(60),
  movement: text(120),
  location: text(200),
  time: text(60),
  description: text(8000).describe('2-4 sub-shot blocks, each starting with [Shot N]'),
  result: text(2000),
  atmosphere: text(2000),
  videoPrompt: text(8000),
  bgmPrompt: text(1000),
  soundEffect: text(1000),
  durationSeconds: z.number().min(SHOT_DURATION_MIN).max(SHOT_DURATION_MAX).optional(),
  sceneId: z.number().int().nullable().optional(),
  characterIds: z.array(z.number().int()).max(20).optional(),
  propIds: z.array(z.number().int()).max(20).optional(),
};

/**
 * Breakdown jobs whose final batch was saved; the job is done only then (so a half-saved storyboard never wins). The
 * accepted storyboard is then closed to the job's writes, so nothing undoes the checks it passed.
 */
const finished = new Set<number>();
const FINAL = 'The storyboard is final and was accepted; reply to finish without saving anything more.';
/** The episode length a running breakdown must meet (null: none), fixed when the job starts (the brief the agent was given). */
const targets = new Map<number, TargetFit | null>();
export const breakdownFinished = (jobId: number) => finished.has(jobId);
export const trackBreakdownTarget = (jobId: number, target: TargetFit | null) => targets.set(jobId, target);
export const forgetBreakdown = (jobId: number) => {
  finished.delete(jobId);
  targets.delete(jobId);
};

/** Why the saved shots miss the job's target length, or null when they meet it (or there is none). */
function missedTarget(jobId: number, episodeId: number): string | null {
  const target = targets.get(jobId);
  if (!target) return null;
  const lengths = liveShotRows(episodeId).map((s) => ({ n: s.shotNumber, s: target.rendered(s.durationSeconds) }));
  const total = lengths.reduce((sum, l) => sum + l.s, 0);
  if (Math.abs(total - target.seconds) <= target.tolerance) return null;
  const fix =
    total > target.seconds
      ? 'Shorten shots with save_shots on their shot numbers or, when that cannot fit, start over with replaceExisting: true (it drops the shots this breakdown saved) and tell the story in fewer shots'
      : 'Lengthen shots with save_shots on their shot numbers';
  return (
    `The shots run ${total} s as the video model renders them (${lengths.map((l) => `#${l.n} ${l.s} s`).join(', ')}), but the episode runs ` +
    `${target.seconds} s, give or take ${target.tolerance} s. ${fix}; keep every shot ${target.lengths}. Then send final: true again.`
  );
}

/** SaveShots: one batch of a breakdown, upserted by shot number (adr-0008 parking on replaceExisting). */
export const saveShotsTool = defineTool({
  id: 'save_shots',
  description:
    'Save up to 8 shots of the breakdown, in order. The first call must set replaceExisting: true; later calls continue the numbering without it. Set final: true on the batch that holds the last shot of the script. A shot with an existing shotNumber is updated.',
  input: z.object({
    replaceExisting: z.boolean().optional(),
    final: z.boolean().optional().describe('true on the batch with the last shot of the script'),
    shots: z
      .array(z.object({ shotNumber: z.number().int().min(1), ...ShotFields }))
      .min(1)
      .max(8)
      .refine((list) => new Set(list.map((s) => s.shotNumber)).size === list.length, 'Each shotNumber may appear only once per batch'),
  }),
  execute: ({ replaceExisting, final, shots }, ctx) => {
    if (!ctx.jobId) return { error: 'save_shots only runs inside a storyboard breakdown' };
    if (finished.has(ctx.jobId)) return { error: FINAL };
    const result = saveShots(
      { episodeId: ctx.episodeId, dramaId: ctx.dramaId, jobId: ctx.jobId },
      { replaceExisting: replaceExisting === true, shots: shots.map((s) => ({ ...clean(s), shotNumber: s.shotNumber })) },
    );
    if (final) {
      // The breakdown replaces the storyboard only when it is complete: shots numbered 1…N with no gap.
      const numbers = liveShotRows(ctx.episodeId).map((s) => s.shotNumber);
      const gap = numbers.findIndex((n, i) => n !== i + 1);
      if (gap !== -1) {
        return {
          saved: result.saved.length,
          shotNumbers: result.saved,
          finished: false,
          error: `The storyboard is not complete: shot numbers must run from 1 without gaps, and shot ${gap + 1} is missing (saved: ${numbers.join(', ')}). Save the missing shots, then send final: true again.`,
        };
      }
      const missed = missedTarget(ctx.jobId, ctx.episodeId);
      if (missed) return { saved: result.saved.length, shotNumbers: result.saved, finished: false, error: missed };
      finished.add(ctx.jobId);
    }
    return { saved: result.saved.length, shotNumbers: result.saved, finished: final === true };
  },
});

/**
 * UpdateShot from an agent. In a run about one shot (the prompt generator) only that shot's videoPrompt may be
 * written.
 */
export const updateShotTool = defineTool({
  id: 'update_shot',
  description: 'Update fields of one saved shot of this episode. Send shotId and only the fields to change.',
  input: z.object({ shotId: z.number().int(), ...ShotFields }),
  execute: ({ shotId, ...fields }, ctx) => {
    const patch = clean(fields);
    if (ctx.target) {
      if (ctx.target.kind !== 'shot' || ctx.target.id !== shotId) return { error: `This run writes shot ${ctx.target.id} only` };
      const extra = Object.keys(patch).filter((k) => k !== 'videoPrompt');
      if (extra.length > 0 || !patch.videoPrompt?.trim()) return { error: 'Send shotId and a non-empty videoPrompt, nothing else' };
    }
    if (Object.keys(patch).length === 0) return { error: 'Nothing to update' };
    if (ctx.jobId && finished.has(ctx.jobId)) return { error: FINAL };
    const shot = getShotRow(shotId);
    if (shot.episodeId !== ctx.episodeId) return { error: `Shot ${shotId} is not in this episode` };
    // A breakdown may only touch the shots it wrote: edits to earlier shots could not be undone if it fails.
    if (ctx.jobId && shot.createdByJobId !== ctx.jobId) return { error: `Shot ${shotId} was not saved by this breakdown; save it with save_shots` };
    const card = writeShotUpdate(shotId, patch);
    return { saved: true, shotNumber: card.shotNumber };
  },
});
