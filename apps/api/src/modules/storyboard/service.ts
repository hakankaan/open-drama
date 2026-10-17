import { existsSync } from 'node:fs';
import { and, asc, eq, inArray, isNull, max, ne, or, sql, sum, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import {
  coverOf,
  isNarrator,
  outfitViews,
  VIDEO_TASK_TYPES,
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
import { viewsOf } from '../assets/views';
import { boundShots, continuationStale } from './staleness';

type ShotRow = typeof shots.$inferSelect;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A check of an earlier video is not shown (adr-0022). A keyframe drawn or kept at an earlier revision than the
 * shot's is stale (adr-0019).
 */
export const toShot = ({ parkedByJobId: _p, createdByJobId: _c, qa, keyframeRevision, keyframeDrawnRevision, ...row }: ShotRow): Shot => ({
  ...row,
  keyframeStale: row.keyframePath !== null && keyframeDrawnRevision !== keyframeRevision,
  qa: qa && qa.videoPath === row.videoPath ? qa : null,
});

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
  // Each character as the shot's episode dresses it (adr-0023).
  const chars = db
    .select({ shotId: shotCharacters.shotId, row: characters, outfit: episodeCharacters.outfit, outfitPath: episodeCharacters.outfitPath })
    .from(shotCharacters)
    .innerJoin(characters, eq(characters.id, shotCharacters.characterId))
    .innerJoin(shots, eq(shots.id, shotCharacters.shotId))
    .leftJoin(episodeCharacters, and(eq(episodeCharacters.episodeId, shots.episodeId), eq(episodeCharacters.characterId, characters.id)))
    .where(and(inArray(shotCharacters.shotId, shotIds), isNull(characters.deletedAt)))
    .orderBy(asc(shotCharacters.sortOrder), asc(characters.id))
    .all();
  for (const { shotId, row, outfit, outfitPath } of chars) {
    if (isNarrator(row.name, row.role)) continue;
    const worn = outfit?.trim() ?? '';
    const views = worn ? outfitViews(viewsOf(row), outfitPath) : viewsOf(row);
    map.get(shotId)?.characters.push({ id: row.id, name: row.name, imagePath: coverOf(views), views, ...(worn ? { outfit: worn } : {}) });
  }
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

/** What each character wears as its asset states it, by id; prompts carry it unless an episode outfit replaces it (adr-0018, adr-0023). */
export function characterStyling(ids: number[]): Map<number, string> {
  if (ids.length === 0) return new Map();
  const rows = db.select({ id: characters.id, styling: characters.styling }).from(characters).where(inArray(characters.id, ids)).all();
  return new Map(rows.map((r) => [r.id, r.styling.trim()]));
}

/** The lighting of a shot's scene, as the scene asset states it ('' without one); video prompts carry it verbatim (adr-0017). */
export function sceneLighting(sceneId: number | null): string {
  if (sceneId === null) return '';
  const row = db.select({ lighting: scenes.lighting }).from(scenes).where(and(eq(scenes.id, sceneId), isNull(scenes.deletedAt))).get();
  return row?.lighting.trim() ?? '';
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

/**
 * The speaker rule (adr-0021): the speaker is one of the shot's bound characters (never a narrator, who speaks over
 * the picture rather than in it), and unbinding them clears it. A new line or speaker clears the line audio, which was
 * spoken for the old one. Runs after the shot's bindings are written; `current` is null for a new shot.
 */
function speakerPatch(
  tx: Tx,
  shotId: number,
  current: Pick<ShotRow, 'speakerId' | 'line'> | null,
  input: { speakerId?: number | null; line?: string },
): Partial<Pick<ShotRow, 'speakerId' | 'lineAudioPath' | 'lineAudioSeconds'>> {
  const speakers = tx
    .select({ id: characters.id, name: characters.name, role: characters.role })
    .from(shotCharacters)
    .innerJoin(characters, eq(characters.id, shotCharacters.characterId))
    .where(and(eq(shotCharacters.shotId, shotId), isNull(characters.deletedAt)))
    .all()
    .filter((c) => !isNarrator(c.name, c.role))
    .map((c) => c.id);
  if (input.speakerId != null && !speakers.includes(input.speakerId)) {
    throw invalid('The speaker must be one of the shot’s characters (not a narrator)', { speakerId: input.speakerId });
  }
  let speakerId = input.speakerId !== undefined ? input.speakerId : (current?.speakerId ?? null);
  if (speakerId !== null && !speakers.includes(speakerId)) speakerId = null;
  const respoken = current !== null && (speakerId !== current.speakerId || (input.line !== undefined && input.line !== current.line));
  return { speakerId, ...(respoken ? { lineAudioPath: null, lineAudioSeconds: null } : {}) };
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

/** The shot fields a keyframe is drawn from, besides the bound characters and props (adr-0019). */
const KEYFRAME_SOURCES = ['imagePrompt', 'sceneId'] as const;
/** What a keyframe is composed from while the shot has no keyframe prompt (`composedMoment`). */
const KEYFRAME_COMPOSED_FROM = ['shotType', 'angle', 'location', 'time', 'description', 'videoPrompt'] as const;
type KeyframeInput = Partial<Pick<ShotRow, 'keyframePath' | (typeof KEYFRAME_SOURCES)[number] | (typeof KEYFRAME_COMPOSED_FROM)[number]>> & {
  keyframeStale?: false;
};

/**
 * The keyframe rule (adr-0019): a change to what the keyframe is drawn from moves the shot's keyframe revision on,
 * which makes the keyframe (or one being drawn) stale; it still goes as the first frame until redrawn, replaced or
 * kept. A keyframe set or removed by hand, or kept (`keyframeStale: false`), is current at the new revision.
 */
function keyframePatch(current: ShotRow, input: KeyframeInput, rebound: boolean): Partial<Record<'keyframeRevision' | 'keyframeDrawnRevision', SQL>> {
  const changed = (k: (typeof KEYFRAME_SOURCES)[number] | (typeof KEYFRAME_COMPOSED_FROM)[number]) =>
    input[k] !== undefined && input[k] !== current[k];
  const composed = (input.imagePrompt ?? current.imagePrompt).trim() === '';
  const moved = rebound || KEYFRAME_SOURCES.some(changed) || (composed && KEYFRAME_COMPOSED_FROM.some(changed));
  const revision = moved ? sql`${shots.keyframeRevision} + 1` : sql`${shots.keyframeRevision}`;
  const kept = input.keyframePath !== undefined || input.keyframeStale === false;
  return { ...(moved ? { keyframeRevision: revision } : {}), ...(kept ? { keyframeDrawnRevision: revision } : {}) };
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
  const ids = boundShots(tx, asset);
  if (ids.length === 0) return;
  for (const id of ids) sourceEdits.set(id, (sourceEdits.get(id) ?? 0) + 1);
  tx.update(shots).set({ videoPromptStale: true }).where(and(inArray(shots.id, ids), ne(shots.videoPrompt, ''))).run();
}

/** The episode's duration is the sum of its live shot durations. */
export function recomputeDuration(tx: Tx, episodeId: number) {
  const total = Number(tx.select({ s: sum(shots.durationSeconds) }).from(shots).where(liveOf(episodeId)).get()?.s ?? 0);
  tx.update(episodes).set({ durationSeconds: total }).where(eq(episodes.id, episodeId)).run();
}

// Read model

/** The live shot before each shot marked as continuing it that has a video (`continuationStale`). */
function shotsBefore(rows: ShotRow[]): Map<number, ShotRow | undefined> {
  const before = new Map<number, ShotRow | undefined>();
  const marked = rows.filter((r) => r.continuesPrevious && r.videoPath);
  for (const episodeId of new Set(marked.map((r) => r.episodeId))) {
    const live = liveShotRows(episodeId);
    for (const r of marked.filter((m) => m.episodeId === episodeId)) before.set(r.id, live[live.findIndex((l) => l.id === r.id) - 1]);
  }
  return before;
}

function toCards(rows: ShotRow[]): ShotCard[] {
  const bindings = loadBindings(rows);
  const ids = rows.map((r) => r.id);
  const videos = latestTasks('video', generationTasks.shotId, ids);
  const keyframes = latestTasks('image', generationTasks.shotId, ids);
  const lines = latestTasks('speech', generationTasks.shotId, ids);
  const syncs = latestTasks('lipsync', generationTasks.shotId, ids);
  const before = shotsBefore(rows);
  return rows.map((r) => ({
    ...toShot(r),
    bindings: bindings.get(r.id)!,
    latestVideoTask: videos.get(r.id) ?? null,
    latestKeyframeTask: keyframes.get(r.id) ?? null,
    latestLineAudioTask: lines.get(r.id) ?? null,
    latestLipSyncTask: syncs.get(r.id) ?? null,
    continuationStale: continuationStale(r, before.get(r.id)),
  }));
}

export const shotCard = (row: ShotRow): ShotCard => toCards([row])[0]!;

/** EpisodeShotList: live shots in shot order with bindings and their latest video and keyframe tasks, plus the storyboard jobs. */
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
  const { episodeId, sceneId, characterIds, propIds, shotNumber, speakerId, ...fields } = input;
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
    if (speakerId != null) tx.update(shots).set(speakerPatch(tx, row.id, null, { speakerId })).where(eq(shots.id, row.id)).run();
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
 * must be one of the shot's completed videos (picking from history), and brings that video's duration along; a
 * keyframe must be a stored file.
 */
export function writeShotUpdate(id: number, input: z.output<typeof UpdateShot>): ShotCard {
  const current = getShotRow(id);
  const ep = getEpisodeRow(current.episodeId);
  assertSomething(input);
  checkReferenceMedia(input.referenceMedia);
  if (input.keyframePath && !existsSync(toAbsolute(input.keyframePath))) throw invalid(`No stored file at ${input.keyframePath}`);
  const { characterIds, propIds, videoPath, speakerId, keyframeStale, ...fields } = input;
  let videoDurationSeconds: number | null | undefined;
  if (videoPath !== undefined) {
    const task = db
      .select({ durationSeconds: generationTasks.durationSeconds })
      .from(generationTasks)
      .where(and(eq(generationTasks.shotId, id), inArray(generationTasks.type, VIDEO_TASK_TYPES), eq(generationTasks.status, 'completed'), eq(generationTasks.localPath, videoPath)))
      .get();
    if (!task) throw invalid('That video is not one of this shot’s results');
    if (!existsSync(toAbsolute(videoPath))) throw invalid(`No stored file at ${videoPath}`);
    videoDurationSeconds = task.durationSeconds;
  }
  db.transaction((tx) => {
    assertBindable(tx, ep.dramaId, { sceneId: fields.sceneId, characterIds, propIds });
    const rebound = writeBindings(tx, id, ep.id, { sceneId: fields.sceneId, characterIds, propIds });
    const video = videoPath !== undefined ? { videoPath, videoDurationSeconds } : {};
    const stale = { ...promptStaleness(current, fields, rebound), ...keyframePatch(current, { ...fields, keyframeStale }, rebound) };
    const speaker = speakerPatch(tx, id, current, { speakerId, line: fields.line });
    tx.update(shots).set({ ...fields, ...video, ...stale, ...speaker, updatedAt: nowIso() }).where(eq(shots.id, id)).run();
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
  continuesPrevious?: boolean;
  speakerId?: number | null;
  line?: string;
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
    for (const { sceneId, characterIds, propIds, shotNumber, speakerId, ...fields } of batch.shots) {
      const existing = tx.select().from(shots).where(and(liveOf(episodeId), eq(shots.shotNumber, shotNumber))).get();
      const values = { ...fields, ...(sceneId !== undefined ? { sceneId } : {}) };
      if (existing) {
        const rebound = writeBindings(tx, existing.id, episodeId, { sceneId, characterIds, propIds });
        const speaker = speakerPatch(tx, existing.id, existing, { speakerId, line: fields.line });
        const stale = { ...promptStaleness(existing, values, rebound), ...keyframePatch(existing, values, rebound) };
        tx.update(shots).set({ ...values, ...stale, ...speaker }).where(eq(shots.id, existing.id)).run();
      } else {
        const shotId = tx
          .insert(shots)
          .values({ ...values, episodeId, shotNumber, createdByJobId: jobId })
          .returning({ id: shots.id })
          .get().id;
        writeBindings(tx, shotId, episodeId, { sceneId, characterIds, propIds });
        if (speakerId != null) tx.update(shots).set(speakerPatch(tx, shotId, null, { speakerId })).where(eq(shots.id, shotId)).run();
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
