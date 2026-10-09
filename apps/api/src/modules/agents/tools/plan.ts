import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { BEATS_MAX_CHARS, BEATS_MIN_CHARS, PlanProgress } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { agentJobs, episodes } from '../../../db/schema';
import { getDramaRow, touchDrama } from '../../production/dramas';
import { episodeStates, insertEpisode, type EpisodeState } from '../../production/episodes';
import { fitRecaps } from '../../production/series';
import { defineDramaTool } from '../runtime/tool';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const PLAN_BATCH_MAX = 8;
/** The last planned episodes whose beats the planner reads in full, so the new ones continue from them. */
const BEATS_IN_FULL = 3;

/**
 * The plan job's state lives on its progress row (adr-0015): the request as resolved at start and the ids written so
 * far. Read inside the batch transaction, so a restart or a second process sees the same thing.
 */
function readPlan(tx: Tx | typeof db, jobId: number): PlanProgress | null {
  const row = tx.select({ progress: agentJobs.progress, status: agentJobs.status }).from(agentJobs).where(eq(agentJobs.id, jobId)).get();
  if (!row || row.status !== 'running') return null;
  const parsed = PlanProgress.safeParse(row.progress);
  return parsed.success ? parsed.data : null;
}

/** How many of the written episodes are still live: a deleted one no longer counts toward `count`. */
function liveWritten(tx: Tx | typeof db, written: number[]): number {
  if (written.length === 0) return 0;
  return tx
    .select({ id: episodes.id })
    .from(episodes)
    .where(and(inArray(episodes.id, written), isNull(episodes.deletedAt)))
    .all().length;
}

export const planFinished = (jobId: number) => readPlan(db, jobId)?.final === true;

/** How many requested episodes still need planning, or null once the plan job is no longer running. */
export function planRemaining(jobId: number): number | null {
  const plan = readPlan(db, jobId);
  return plan ? Math.max(0, plan.count - liveWritten(db, plan.written)) : null;
}

export const readStoryForPlanning = defineDramaTool({
  id: 'read_story_for_planning',
  description:
    "Read the project's premise and story outline, the request (how many episodes to plan, the target length of each, the total seconds, the number the first new episode gets, how many remain) and every episode with its state: written (recap ready or stale, or missing with its synopsis), planned (synopsis, and the beats in full for the last three planned ones) or empty. omittedRecaps names the written episodes whose recap text was left out for size.",
  input: z.object({}),
  execute: (_input, ctx) => {
    if (ctx.jobId === undefined) return { error: 'read_story_for_planning only runs inside a plan job' };
    const plan = readPlan(db, ctx.jobId);
    if (!plan) return { error: 'The plan job is no longer running' };
    const drama = getDramaRow(ctx.dramaId);
    const states = episodeStates(ctx.dramaId);
    const planned = states.filter((e) => e.state === 'planned');
    const inFull = new Set(planned.slice(-BEATS_IN_FULL).map((e) => e.id));
    const written = liveWritten(db, plan.written);
    const remaining = Math.max(0, plan.count - written);
    const target = plan.targetDurationSeconds;
    const base = {
      premise: { title: drama.title, synopsis: drama.description, genre: drama.genre, tags: drama.tags, serial: drama.serial },
      outline: drama.outline,
      request: {
        count: plan.count,
        targetDurationSeconds: target,
        totalSeconds: target === null ? null : target * plan.count,
        firstEpisodeNumber: (states.at(-1)?.episodeNumber ?? 0) + 1,
        written,
        remaining,
      },
    };
    const entries = states.map((e): PlanningEpisode => {
      const entry: PlanningEpisode = { episodeNumber: e.episodeNumber, title: e.title, state: e.state, synopsis: e.synopsis };
      if (e.state === 'written') {
        entry.recapStatus = e.recapStatus;
        if (e.recap) entry.recap = e.recap;
      } else if (e.state === 'planned' && inFull.has(e.id)) {
        entry.beats = e.beats;
      }
      return entry;
    });
    // The beats stay (at most three sheets); only the oldest recaps go beyond the series budget, and are named.
    const omittedRecaps = fitRecaps(entries, base);
    return { ...base, episodes: entries, ...(omittedRecaps.length > 0 ? { omittedRecaps } : {}) };
  },
});

interface PlanningEpisode {
  episodeNumber: number;
  title: string;
  state: EpisodeState['state'];
  synopsis: string;
  recapStatus?: EpisodeState['recapStatus'];
  recap?: string;
  beats?: string;
}

const PlannedEpisode = z.object({
  title: z.string().trim().min(1).max(120),
  synopsis: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .refine((s) => !/[\r\n]/.test(s), 'The synopsis is one line'),
  beats: z.string().trim().min(1).describe(`The beat sheet, ${BEATS_MIN_CHARS} to ${BEATS_MAX_CHARS} characters, ending on the hook into the next episode`),
});

/**
 * AddPlannedEpisodes (adr-0015): one transaction per batch; the next numbers are taken inside it through the same
 * insert CreateEpisode uses, and the new ids land on the job's progress row in the same transaction.
 */
export const saveEpisodes = defineDramaTool({
  id: 'save_episodes',
  description: `Add the next planned episodes, at most ${PLAN_BATCH_MAX} per call, in story order: each with a title, a synopsis and its beat sheet (${BEATS_MIN_CHARS} to ${BEATS_MAX_CHARS} characters, ending on the hook into the next episode). Set final: true on the call that completes the requested count; once every requested episode exists, final: true alone is accepted. The result names the episode numbers written and how many remain.`,
  input: z.object({
    episodes: z.array(PlannedEpisode).max(PLAN_BATCH_MAX).default([]),
    final: z.boolean().default(false).describe('True once this batch completes the requested count'),
  }),
  execute: ({ episodes: items, final }, ctx) => {
    if (ctx.jobId === undefined) return { error: 'save_episodes only runs inside a plan job' };
    const jobId = ctx.jobId;
    for (const [i, item] of items.entries()) {
      if (item.beats.length < BEATS_MIN_CHARS) return { error: `Episode ${i + 1} of this batch has a beat sheet of ${item.beats.length} characters; write at least ${BEATS_MIN_CHARS}.` };
      if (item.beats.length > BEATS_MAX_CHARS) return { error: `Episode ${i + 1} of this batch has a beat sheet of ${item.beats.length} characters; shorten it to at most ${BEATS_MAX_CHARS}.` };
    }
    if (items.length === 0 && !final) return { error: 'Send at least one episode, or final: true alone once every requested episode exists.' };
    const outcome = db.transaction((tx) => {
      const plan = readPlan(tx, jobId);
      if (!plan) return { error: 'The plan job is no longer running' };
      const before = liveWritten(tx, plan.written);
      const room = plan.count - before;
      if (items.length > room) {
        return { error: `Only ${room} more ${room === 1 ? 'episode' : 'episodes'} may be planned (${plan.count} requested, ${before} written); send at most ${room}.` };
      }
      const numbers: number[] = [];
      const ids: number[] = [];
      for (const item of items) {
        const row = insertEpisode(tx, {
          dramaId: ctx.dramaId,
          title: item.title,
          description: item.synopsis,
          content: item.beats,
          resolution: plan.resolution,
          targetDurationSeconds: plan.targetDurationSeconds,
          imageServiceId: plan.imageServiceId,
          videoServiceId: plan.videoServiceId,
        });
        numbers.push(row.episodeNumber);
        ids.push(row.id);
      }
      const written = [...plan.written, ...ids];
      const live = before + ids.length;
      const remaining = plan.count - live;
      const accepted = final && remaining === 0;
      tx.update(agentJobs)
        .set({ progress: { ...plan, written, ...(accepted ? { final: true } : {}) } })
        .where(eq(agentJobs.id, jobId))
        .run();
      return { numbers, remaining, final: accepted, deleted: plan.written.length - before };
    });
    if ('error' in outcome) return outcome;
    if (outcome.numbers.length > 0) touchDrama(ctx.dramaId);
    const wrote = outcome.numbers.length > 0 ? `Wrote ${outcome.numbers.length === 1 ? 'episode' : 'episodes'} ${outcome.numbers.join(', ')}.` : 'Nothing written.';
    if (final && !outcome.final) {
      const gone = outcome.deleted > 0 ? ` (${outcome.deleted} planned earlier ${outcome.deleted === 1 ? 'was' : 'were'} deleted and no longer count)` : '';
      return { error: `${wrote} final was refused: ${outcome.remaining} of the requested episodes still ${outcome.remaining === 1 ? 'needs' : 'need'} planning${gone}; plan ${outcome.remaining} more and send final again.`, written: outcome.numbers, remaining: outcome.remaining };
    }
    return { written: outcome.numbers, remaining: outcome.remaining, final: outcome.final };
  },
});
