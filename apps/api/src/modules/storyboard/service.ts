import { existsSync } from 'node:fs';
import { and, asc, eq, inArray, isNull, max, ne, or, sum } from 'drizzle-orm';
import type { z } from 'zod';
import {
  isNarrator,
  type AssetKind,
  type CreateShot,
  type EpisodeShotList,
  type ReferenceMedia,
  type Shot,
  type ShotAssetRef,
  type ShotCard,
  type UpdateShot,
} from '@open-drama/contracts';
import { db } from '../../db/client';
import {
  agentJobs,
  characters,
  episodeCharacters,
  episodeProps,
  episodeScenes,
  episodes,
  generationTasks,
  props,
  scenes,
  shotCharacters,
  shotProps,
  shots,
} from '../../db/schema';
import { nowIso } from '../../db/schema/columns';
import { assertSomething, conflict, invalid, notFound } from '../../http/errors';
import { toAbsolute } from '../../lib/paths';
import { latestTasks } from '../generation/tasks';
import { getEpisodeJobs } from '../jobs/run-job';
import { touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';

type ShotRow = typeof shots.$inferSelect;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const toShot = ({ parkedByJobId: _p, createdByJobId: _c, ...row }: ShotRow): Shot => row;

/** A live shot (parked shots belong to a running breakdown and are not addressable). */
export function getShotRow(id: number): ShotRow {
  const row = db
    .select()
    .from(shots)
    .where(and(eq(shots.id, id), isNull(shots.parkedByJobId)))
    .get();
  if (!row) throw notFound('Shot');
  return row;
}

const liveOf = (episodeId: number) => and(eq(shots.episodeId, episodeId), isNull(shots.parkedByJobId));

// Bindings

export interface ShotBindings {
  scene: ShotAssetRef | null;
  characters: ShotAssetRef[];
  props: ShotAssetRef[];
}

/** Bound assets per shot in binding order; deleted assets and narrators are left out. */
export function loadBindings(rows: ShotRow[]): Map<number, ShotBindings> {
  const map = new Map<number, ShotBindings>(rows.map((r) => [r.id, { scene: null, characters: [], props: [] }]));
  if (rows.length === 0) return map;
  const shotIds = rows.map((r) => r.id);
  const chars = db
    .select({ shotId: shotCharacters.shotId, id: characters.id, name: characters.name, role: characters.role, imagePath: characters.imagePath })
    .from(shotCharacters)
    .innerJoin(characters, eq(characters.id, shotCharacters.characterId))
    .where(and(inArray(shotCharacters.shotId, shotIds), isNull(characters.deletedAt)))
    .orderBy(asc(shotCharacters.sortOrder), asc(characters.id))
    .all();
  for (const { shotId, role, ...ref } of chars) if (!isNarrator(ref.name, role)) map.get(shotId)?.characters.push(ref);
  const prps = db
    .select({ shotId: shotProps.shotId, id: props.id, name: props.name, imagePath: props.imagePath })
    .from(shotProps)
    .innerJoin(props, eq(props.id, shotProps.propId))
    .where(and(inArray(shotProps.shotId, shotIds), isNull(props.deletedAt)))
    .orderBy(asc(shotProps.sortOrder), asc(props.id))
    .all();
  for (const { shotId, ...ref } of prps) map.get(shotId)?.props.push(ref);
  const sceneIds = [...new Set(rows.map((r) => r.sceneId).filter((id): id is number => id !== null))];
  if (sceneIds.length > 0) {
    const scs = db
      .select({ id: scenes.id, location: scenes.location, imagePath: scenes.imagePath })
      .from(scenes)
      .where(and(inArray(scenes.id, sceneIds), isNull(scenes.deletedAt)))
      .all();
    const byId = new Map(scs.map((s) => [s.id, { id: s.id, name: s.location, imagePath: s.imagePath }]));
    for (const r of rows) if (r.sceneId !== null) map.get(r.id)!.scene = byId.get(r.sceneId) ?? null;
  }
  return map;
}

export interface BindingInput {
  sceneId?: number | null;
  characterIds?: number[];
  propIds?: number[];
}

/** Every bound asset must be a live asset of the drama (domain rejection "Binding refers to an asset outside the drama"). */
function assertBindable(tx: Tx, dramaId: number, input: BindingInput) {
  const check = (
    table: typeof characters | typeof scenes | typeof props,
    wanted: number[],
    what: string,
  ) => {
    if (wanted.length === 0) return;
    const found = new Set(
      tx
        .select({ id: table.id })
        .from(table)
        .where(and(inArray(table.id, wanted), eq(table.dramaId, dramaId), isNull(table.deletedAt)))
        .all()
        .map((r) => r.id),
    );
    const missing = wanted.filter((id) => !found.has(id));
    if (missing.length > 0) throw invalid(`No ${what} ${missing.join(', ')} in this project`, { [what]: missing });
  };
  if (input.sceneId != null) check(scenes, [input.sceneId], 'scene');
  check(characters, input.characterIds ?? [], 'character');
  check(props, input.propIds ?? [], 'prop');
}

const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Writes the given bindings of one shot; binding an asset links it to the episode. Omitted kinds are kept. Returns
 * whether the bound characters or props changed (the scene is a shot field).
 */
function writeBindings(tx: Tx, shotId: number, episodeId: number, input: BindingInput): boolean {
  let changed = false;
  if (input.sceneId != null) {
    tx.insert(episodeScenes).values({ episodeId, sceneId: input.sceneId }).onConflictDoNothing().run();
  }
  if (input.characterIds) {
    const list = [...new Set(input.characterIds)];
    const before = tx.select({ id: shotCharacters.characterId }).from(shotCharacters).where(eq(shotCharacters.shotId, shotId)).all();
    changed ||= !sameIds(before.map((r) => r.id), list);
    tx.delete(shotCharacters).where(eq(shotCharacters.shotId, shotId)).run();
    list.forEach((characterId, sortOrder) => {
      tx.insert(shotCharacters).values({ shotId, characterId, sortOrder }).run();
      tx.insert(episodeCharacters).values({ episodeId, characterId }).onConflictDoNothing().run();
    });
  }
  if (input.propIds) {
    const list = [...new Set(input.propIds)];
    const before = tx.select({ id: shotProps.propId }).from(shotProps).where(eq(shotProps.shotId, shotId)).all();
    changed ||= !sameIds(before.map((r) => r.id), list);
    tx.delete(shotProps).where(eq(shotProps.shotId, shotId)).run();
    list.forEach((propId, sortOrder) => {
      tx.insert(shotProps).values({ shotId, propId, sortOrder }).run();
      tx.insert(episodeProps).values({ episodeId, propId }).onConflictDoNothing().run();
    });
  }
  return changed;
}

/** The shot fields a video prompt is written from, besides the bound characters and props. */
const PROMPT_SOURCES = ['durationSeconds', 'description', 'atmosphere', 'shotType', 'angle', 'movement', 'sceneId'] as const;

/** Changes to each shot's prompt sources since the server started; a prompt run compares them (watchPromptSources). */
const sourceEdits = new Map<number, number>();

/**
 * The videoPrompt rule (the assets' final-prompt rule): writing the prompt clears the stale flag; otherwise a change
 * to a field it was written from keeps the prompt and marks it stale, since its per-second timings and mentions may
 * no longer fit the shot. Every source change is counted for watchPromptSources.
 */
function promptStaleness(
  current: ShotRow,
  input: Partial<Pick<ShotRow, 'videoPrompt' | (typeof PROMPT_SOURCES)[number]>>,
  rebound: boolean,
): { videoPromptStale?: boolean } {
  const changed = rebound || PROMPT_SOURCES.some((k) => input[k] !== undefined && input[k] !== current[k]);
  if (changed) sourceEdits.set(current.id, (sourceEdits.get(current.id) ?? 0) + 1);
  if (input.videoPrompt !== undefined) return { videoPromptStale: false };
  return changed && current.videoPrompt.trim() ? { videoPromptStale: true } : {};
}

/**
 * For a prompt written by an agent run: call before the run, and the returned check once the prompt is saved. A
 * source the creator changed meanwhile (even back to what it was) marks the new prompt stale, since it may have been
 * written from the shot as it was.
 */
export function watchPromptSources(shotId: number): () => void {
  const before = sourceEdits.get(shotId) ?? 0;
  return () => {
    if ((sourceEdits.get(shotId) ?? 0) !== before) db.update(shots).set({ videoPromptStale: true }).where(eq(shots.id, shotId)).run();
  };
}

/**
 * A bound asset was deleted or renamed: the prompts of the shots it is bound to name it (or rely on its binding), so
 * they go stale like any other source change. Called inside the asset's transaction, before its bindings go.
 */
export function markAssetPromptsStale(tx: Tx, asset: { kind: AssetKind; id: number }) {
  const ids =
    asset.kind === 'scene'
      ? tx.select({ id: shots.id }).from(shots).where(eq(shots.sceneId, asset.id)).all().map((r) => r.id)
      : asset.kind === 'character'
        ? tx.select({ id: shotCharacters.shotId }).from(shotCharacters).where(eq(shotCharacters.characterId, asset.id)).all().map((r) => r.id)
        : tx.select({ id: shotProps.shotId }).from(shotProps).where(eq(shotProps.propId, asset.id)).all().map((r) => r.id);
  if (ids.length === 0) return;
  for (const id of ids) sourceEdits.set(id, (sourceEdits.get(id) ?? 0) + 1);
  tx.update(shots).set({ videoPromptStale: true }).where(and(inArray(shots.id, ids), ne(shots.videoPrompt, ''))).run();
}

/** The episode's duration is the sum of its live shot durations. */
function recomputeDuration(tx: Tx, episodeId: number) {
  const total = Number(tx.select({ s: sum(shots.durationSeconds) }).from(shots).where(liveOf(episodeId)).get()?.s ?? 0);
  tx.update(episodes).set({ durationSeconds: total }).where(eq(episodes.id, episodeId)).run();
}

// Read model

function toCards(rows: ShotRow[]): ShotCard[] {
  const bindings = loadBindings(rows);
  const tasks = latestTasks('video', generationTasks.shotId, rows.map((r) => r.id));
  return rows.map((r) => ({ ...toShot(r), bindings: bindings.get(r.id)!, latestVideoTask: tasks.get(r.id) ?? null }));
}

export const shotCard = (row: ShotRow): ShotCard => toCards([row])[0]!;

/** EpisodeShotList: live shots in shot order with bindings and their latest video task, plus the storyboard jobs. */
export function getEpisodeShots(episodeId: number): EpisodeShotList {
  getEpisodeRow(episodeId);
  const rows = liveShotRows(episodeId);
  const jobs = getEpisodeJobs(episodeId);
  return {
    episodeId,
    shots: toCards(rows),
    breakdown: jobs.breakdown,
    videoPromptBatch: jobs.videoPromptBatch,
    generatedCount: rows.filter((r) => r.videoPath).length,
    totalDurationSeconds: rows.reduce((n, r) => n + r.durationSeconds, 0),
  };
}

// Commands

/**
 * While a breakdown runs, its batches own the episode's shots (adr-0008 parking): creator commands on shots are
 * refused so nothing is written to a row the job may drop or restore.
 */
export function assertNoBreakdown(episodeId: number) {
  const running = db
    .select({ id: agentJobs.id })
    .from(agentJobs)
    .where(and(eq(agentJobs.episodeId, episodeId), eq(agentJobs.kind, 'breakdown'), eq(agentJobs.status, 'running')))
    .get();
  if (running) throw conflict('A storyboard breakdown is running; try again once it has finished', { jobId: running.id });
}

function checkReferenceMedia(media: ReferenceMedia | undefined) {
  for (const path of [...(media?.imageUrls ?? []), ...(media?.videoUrls ?? []), ...(media?.audioUrls ?? [])]) {
    if (!existsSync(toAbsolute(path))) throw invalid(`No stored file at ${path}`);
  }
}

/** CreateShot. Refused while a breakdown runs: its batches replace the episode's shots by number. */
export function createShot(input: z.output<typeof CreateShot>): ShotCard {
  const ep = getEpisodeRow(input.episodeId);
  assertNoBreakdown(ep.id);
  const { episodeId, sceneId, characterIds, propIds, shotNumber, ...fields } = input;
  const id = db.transaction((tx) => {
    assertBindable(tx, ep.dramaId, { sceneId, characterIds, propIds });
    const next = (tx.select({ n: max(shots.shotNumber) }).from(shots).where(liveOf(episodeId)).get()?.n ?? 0) + 1;
    const number = shotNumber ?? next;
    const clash = tx.select({ id: shots.id }).from(shots).where(and(liveOf(episodeId), eq(shots.shotNumber, number))).get();
    if (clash) throw conflict(`Shot #${number} already exists`, { existingId: clash.id });
    const row = tx
      .insert(shots)
      .values({ ...fields, episodeId, shotNumber: number, sceneId: sceneId ?? null })
      .returning({ id: shots.id })
      .get();
    writeBindings(tx, row.id, episodeId, { sceneId, characterIds, propIds });
    recomputeDuration(tx, episodeId);
    return row.id;
  });
  touchDrama(ep.dramaId);
  return shotCard(getShotRow(id));
}

/** UpdateShot from the creator (refused while a breakdown runs). */
export function updateShot(id: number, input: z.output<typeof UpdateShot>): ShotCard {
  assertNoBreakdown(getShotRow(id).episodeId);
  return writeShotUpdate(id, input);
}

/**
 * UpdateShot as written by the creator or an agent tool: any field; bindings are validated and linked; `videoPath`
 * must be one of the shot's completed videos (picking from history), and brings that video's duration along.
 */
export function writeShotUpdate(id: number, input: z.output<typeof UpdateShot>): ShotCard {
  const current = getShotRow(id);
  const ep = getEpisodeRow(current.episodeId);
  assertSomething(input);
  checkReferenceMedia(input.referenceMedia);
  const { characterIds, propIds, videoPath, ...fields } = input;
  let videoDurationSeconds: number | null | undefined;
  if (videoPath !== undefined) {
    const task = db
      .select({ durationSeconds: generationTasks.durationSeconds })
      .from(generationTasks)
      .where(and(eq(generationTasks.shotId, id), eq(generationTasks.type, 'video'), eq(generationTasks.status, 'completed'), eq(generationTasks.localPath, videoPath)))
      .get();
    if (!task) throw invalid('That video is not one of this shot’s results');
    if (!existsSync(toAbsolute(videoPath))) throw invalid(`No stored file at ${videoPath}`);
    videoDurationSeconds = task.durationSeconds;
  }
  db.transaction((tx) => {
    assertBindable(tx, ep.dramaId, { sceneId: fields.sceneId, characterIds, propIds });
    const rebound = writeBindings(tx, id, ep.id, { sceneId: fields.sceneId, characterIds, propIds });
    const video = videoPath !== undefined ? { videoPath, videoDurationSeconds } : {};
    const stale = promptStaleness(current, fields, rebound);
    tx.update(shots).set({ ...fields, ...video, ...stale, updatedAt: nowIso() }).where(eq(shots.id, id)).run();
    if (fields.durationSeconds !== undefined) recomputeDuration(tx, ep.id);
  });
  touchDrama(ep.dramaId);
  return shotCard(getShotRow(id));
}

/** DeleteShot: hard delete with its bindings; its generation tasks stay in history. */
export function deleteShot(id: number): { id: number } {
  const current = getShotRow(id);
  const ep = getEpisodeRow(current.episodeId);
  assertNoBreakdown(ep.id);
  db.transaction((tx) => {
    tx.delete(shots).where(eq(shots.id, id)).run();
    recomputeDuration(tx, ep.id);
  });
  touchDrama(ep.dramaId);
  return { id };
}

// Breakdown batches (adr-0008 parking)

export interface ShotInput extends BindingInput {
  shotNumber: number;
  title?: string;
  shotType?: string;
  angle?: string;
  movement?: string;
  location?: string;
  time?: string;
  description?: string;
  result?: string;
  atmosphere?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  bgmPrompt?: string;
  soundEffect?: string;
  durationSeconds?: number;
}

/**
 * SaveShots for a breakdown job: upsert by shotNumber in one transaction. The job's first batch must set
 * replaceExisting, so the job never edits earlier shots in place. replaceExisting parks the live shots the job did
 * not write (restored if the job fails) and drops the ones it did (the agent starting over).
 */
export function saveShots(
  scope: { episodeId: number; dramaId: number; jobId: number },
  batch: { replaceExisting: boolean; shots: ShotInput[] },
): { saved: number[] } {
  const { episodeId, dramaId, jobId } = scope;
  const saved = db.transaction((tx) => {
    const started = tx
      .select({ id: shots.id })
      .from(shots)
      .where(and(eq(shots.episodeId, episodeId), or(eq(shots.createdByJobId, jobId), eq(shots.parkedByJobId, jobId))))
      .get();
    if (!batch.replaceExisting && !started) {
      throw invalid('The first save_shots call of a breakdown must set replaceExisting: true');
    }
    for (const shot of batch.shots) assertBindable(tx, dramaId, shot);
    if (batch.replaceExisting) {
      tx.delete(shots).where(and(liveOf(episodeId), eq(shots.createdByJobId, jobId))).run();
      tx.update(shots)
        .set({ parkedByJobId: jobId })
        .where(and(liveOf(episodeId), or(isNull(shots.createdByJobId), ne(shots.createdByJobId, jobId))))
        .run();
    }
    const numbers: number[] = [];
    for (const { sceneId, characterIds, propIds, shotNumber, ...fields } of batch.shots) {
      const existing = tx.select().from(shots).where(and(liveOf(episodeId), eq(shots.shotNumber, shotNumber))).get();
      const values = { ...fields, ...(sceneId !== undefined ? { sceneId } : {}) };
      if (existing) {
        const rebound = writeBindings(tx, existing.id, episodeId, { sceneId, characterIds, propIds });
        tx.update(shots).set({ ...values, ...promptStaleness(existing, values, rebound) }).where(eq(shots.id, existing.id)).run();
      } else {
        const shotId = tx
          .insert(shots)
          .values({ ...values, episodeId, shotNumber, createdByJobId: jobId })
          .returning({ id: shots.id })
          .get().id;
        writeBindings(tx, shotId, episodeId, { sceneId, characterIds, propIds });
      }
      numbers.push(shotNumber);
    }
    recomputeDuration(tx, episodeId);
    return numbers;
  });
  touchDrama(dramaId);
  return { saved };
}

/** StoryboardBreakdownCompleted, inside the transaction that marks the job done: the parked shots are gone for good. */
export function purgeParkedShots(tx: Tx, jobId: number, episodeId: number) {
  tx.delete(shots).where(eq(shots.parkedByJobId, jobId)).run();
  recomputeDuration(tx, episodeId);
}

/**
 * StoryboardBreakdownFailed (and boot cleanup), inside the transaction that marks the job failed: the shots the job
 * wrote are removed and the ones it parked come back. Shots the creator added outside the job are untouched.
 */
export function restoreParkedShots(tx: Tx, jobId: number, episodeId: number): number {
  tx.delete(shots).where(and(liveOf(episodeId), eq(shots.createdByJobId, jobId))).run();
  const restored = tx.update(shots).set({ parkedByJobId: null }).where(eq(shots.parkedByJobId, jobId)).run().changes;
  recomputeDuration(tx, episodeId);
  return restored;
}

/** Live shots of an episode in shot order. */
export const liveShotRows = (episodeId: number): ShotRow[] =>
  db.select().from(shots).where(liveOf(episodeId)).orderBy(asc(shots.shotNumber)).all();
