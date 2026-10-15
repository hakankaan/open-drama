import { and, count, eq, isNull, max } from 'drizzle-orm';
import type { z } from 'zod';
import type { CreateEpisode, Episode, EpisodeView, LockedService, RecapStatus, Resolution, ServiceType, UpdateEpisode } from '@open-drama/contracts';
import { db } from '../../db/client';
import { episodes, shots } from '../../db/schema';
import { assertSomething, conflict, notFound, precondition } from '../../http/errors';
import { resolveService } from '../configuration/services';
import { getEpisodeJobs, runningJobKinds } from '../jobs/run-job';
import { getDramaRow, touchDrama } from './dramas';

type Row = typeof episodes.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/** A recap written for another revision of the script is stale (adr-0014); an empty one is simply missing. */
export const isRecapStale = (row: Pick<Row, 'recap' | 'recapScriptRevision' | 'scriptRevision'>) =>
  row.recap !== '' && row.recapScriptRevision !== row.scriptRevision;

/**
 * The script revision a recap was written for stays internal; the view carries the derived staleness, and the three
 * text revisions an assistant passes back as freshness tokens (adr-0016).
 */
export const toEpisode = ({ deletedAt: _deletedAt, recapScriptRevision, ...row }: Row): Episode => ({
  ...row,
  recapStale: isRecapStale({ recap: row.recap, scriptRevision: row.scriptRevision, recapScriptRevision }),
});

/** A live episode of a live drama. */
export function getEpisodeRow(id: number): Row {
  const row = db
    .select()
    .from(episodes)
    .where(and(eq(episodes.id, id), isNull(episodes.deletedAt)))
    .get();
  if (!row) throw notFound('Episode');
  getDramaRow(row.dramaId);
  return row;
}

/**
 * The model an episode's requests use without a model pick: the pinned one while the episode's locked service still
 * lists it, else the service's first (adr-0017). A fallback service never takes the pin.
 */
export const pinnedOr = (models: string[], pinned: string | null, onLock: boolean): string | undefined =>
  onLock && pinned && models.includes(pinned) ? pinned : models[0];

function lockedService(type: ServiceType, lockedId: number | null, pinned: string | null): LockedService | null {
  const resolved = resolveService(type, { lockedId });
  if (!resolved) return null;
  const { row, locked } = resolved;
  return { id: row.id, name: row.name, provider: row.provider, defaultModel: pinnedOr(row.models, pinned, locked) ?? null, locked };
}

export function getEpisodeView(id: number): EpisodeView {
  const row = getEpisodeRow(id);
  return {
    ...toEpisode(row),
    services: {
      image: lockedService('image', row.imageServiceId, null),
      video: lockedService('video', row.videoServiceId, row.videoModel),
    },
  };
}

/**
 * CreateEpisode: next number (max + 1 among live episodes), default title, and the image and video locks: an explicit
 * id is checked and locked at once, a type with a usable service locks the highest-priority one, and a type without
 * one stays unlocked until the first generation (adr-0016), so the story room runs with a text service alone.
 */
export function createEpisode(input: z.output<typeof CreateEpisode>): EpisodeView {
  const drama = getDramaRow(input.dramaId);
  const services = lockServices(input);
  const { id } = db.transaction((tx) =>
    insertEpisode(tx, {
      dramaId: drama.id,
      title: input.title?.trim(),
      resolution: input.resolution,
      targetDurationSeconds: input.targetDurationSeconds ?? null,
      ...services,
    }),
  );
  touchDrama(drama.id);
  return getEpisodeView(id);
}

export interface ServiceLocks {
  imageServiceId: number | null;
  videoServiceId: number | null;
}

/** An explicit id must be a service of the type, active (resolveService's checks); else the highest-priority usable one, else nothing. */
const lockFor = (type: ServiceType, id: number | undefined) => resolveService(type, { explicitId: id })?.row.id ?? null;

/**
 * The image and video services a new episode starts with, shared by CreateEpisode and PlanEpisodes: the explicit ids,
 * else the usable service of each type, else nothing. An empty lock is claimed by the first generation of the type
 * (claimServiceLock).
 */
export function lockServices(input: { imageServiceId?: number; videoServiceId?: number }): ServiceLocks {
  return { imageServiceId: lockFor('image', input.imageServiceId), videoServiceId: lockFor('video', input.videoServiceId) };
}

/**
 * The first generation of a type claims the empty lock before it starts (adr-0016): compare-and-set on the empty
 * column, then the stored id is read back, so two first generations racing each other both go on with the one
 * service that won. Never written over a lock.
 */
export function claimServiceLock(episodeId: number, type: 'image' | 'video', serviceId: number): number {
  const column = type === 'image' ? episodes.imageServiceId : episodes.videoServiceId;
  return db.transaction((tx) => {
    tx.update(episodes)
      .set(type === 'image' ? { imageServiceId: serviceId } : { videoServiceId: serviceId })
      .where(and(eq(episodes.id, episodeId), isNull(column)))
      .run();
    const row = tx.select({ locked: column }).from(episodes).where(eq(episodes.id, episodeId)).get();
    if (!row) throw notFound('Episode');
    return row.locked ?? serviceId;
  });
}

/**
 * The video model of a request without a model pick, in the episode's locked service (adr-0017): the pin while the
 * service lists it; else the service's first model, which becomes the pin. One transaction, so racing first videos
 * share one model. A pin the service no longer lists (the creator removed it) moves to the first model.
 */
export function claimVideoModel(episodeId: number, models: string[]): string | undefined {
  return db.transaction((tx) => {
    const row = tx.select({ pinned: episodes.videoModel }).from(episodes).where(eq(episodes.id, episodeId)).get();
    if (!row) throw notFound('Episode');
    const model = pinnedOr(models, row.pinned, true);
    if (model && model !== row.pinned) tx.update(episodes).set({ videoModel: model }).where(eq(episodes.id, episodeId)).run();
    return model;
  });
}

/** What an episode holds, as the story writer and the planner read it (adr-0015). */
export interface EpisodeState {
  id: number;
  episodeNumber: number;
  title: string;
  /** written: it has a script; planned: beats (raw content) but no script; empty: neither. */
  state: 'written' | 'planned' | 'empty';
  synopsis: string;
  targetDurationSeconds: number | null;
  /** Written episodes only. */
  recapStatus?: RecapStatus;
  recap?: string;
  /** Planned episodes only: the beat sheet. */
  beats?: string;
}

/** The live episodes of a drama in order, each with its state (adr-0015). */
export function episodeStates(dramaId: number): EpisodeState[] {
  return db
    .select()
    .from(episodes)
    .where(and(eq(episodes.dramaId, dramaId), isNull(episodes.deletedAt)))
    .orderBy(episodes.episodeNumber)
    .all()
    .map((row) => {
      const base = { id: row.id, episodeNumber: row.episodeNumber, title: row.title, synopsis: row.description, targetDurationSeconds: row.targetDurationSeconds };
      if (row.scriptContent?.trim()) {
        const recap = row.recap.trim();
        const recapStatus: RecapStatus = !recap ? 'missing' : isRecapStale(row) ? 'stale' : 'ready';
        return { ...base, state: 'written' as const, recapStatus, ...(recap ? { recap } : {}) };
      }
      const beats = row.content.trim();
      if (beats) return { ...base, state: 'planned' as const, beats };
      return { ...base, state: 'empty' as const };
    });
}

export interface NewEpisode extends ServiceLocks {
  dramaId: number;
  /** Empty or absent: `Episode N`. */
  title?: string;
  description?: string;
  content?: string;
  resolution: Resolution;
  targetDurationSeconds: number | null;
}

/**
 * The one insert of an episode row, used by CreateEpisode and by the planner's batches (adr-0015): the next number
 * (max + 1 among live episodes) is taken inside the caller's transaction, so concurrent inserts never collide.
 */
export function insertEpisode(tx: Tx, values: NewEpisode): { id: number; episodeNumber: number } {
  const last =
    tx
      .select({ n: max(episodes.episodeNumber) })
      .from(episodes)
      .where(and(eq(episodes.dramaId, values.dramaId), isNull(episodes.deletedAt)))
      .get()?.n ?? 0;
  const episodeNumber = last + 1;
  const { id } = tx
    .insert(episodes)
    .values({
      dramaId: values.dramaId,
      episodeNumber,
      title: values.title?.trim() || `Episode ${episodeNumber}`,
      description: values.description ?? '',
      content: values.content ?? '',
      resolution: values.resolution,
      targetDurationSeconds: values.targetDurationSeconds,
      imageServiceId: values.imageServiceId,
      videoServiceId: values.videoServiceId,
    })
    .returning({ id: episodes.id })
    .get();
  return { id, episodeNumber };
}

/** The three texts an episode holds, each with its own revision (adr-0016). */
export type EpisodeTextPart = 'beats' | 'script' | 'recap';
const PART_NAMES: Record<EpisodeTextPart, string> = { beats: 'beat sheet', script: 'script', recap: 'recap' };

/**
 * UpdateEpisodeContent's write of the beats (the raw content): the one writer of `content`. The beats revision moves
 * only when the text changes. Returns the revision the beats now have.
 */
export function writeBeats(id: number, text: string, tx: Db = db): number {
  const row = tx.select({ content: episodes.content, beatsRevision: episodes.beatsRevision }).from(episodes).where(eq(episodes.id, id)).get();
  if (!row) throw notFound('Episode');
  if (row.content === text) return row.beatsRevision;
  const beatsRevision = row.beatsRevision + 1;
  tx.update(episodes).set({ content: text, beatsRevision }).where(eq(episodes.id, id)).run();
  return beatsRevision;
}

/**
 * SaveScript: the one writer of scriptContent. The script revision moves only when the text actually changes,
 * so a recap stays fresh across a no-op save. Returns the revision the script now has.
 */
export function writeScript(id: number, text: string, tx: Db = db): number {
  const row = tx
    .select({ scriptContent: episodes.scriptContent, scriptRevision: episodes.scriptRevision })
    .from(episodes)
    .where(eq(episodes.id, id))
    .get();
  if (!row) throw notFound('Episode');
  if (row.scriptContent === text) return row.scriptRevision;
  const scriptRevision = row.scriptRevision + 1;
  tx.update(episodes).set({ scriptContent: text, scriptRevision }).where(eq(episodes.id, id)).run();
  return scriptRevision;
}

/**
 * SaveRecap, pinned to a script revision: the creator's edit pins to the current one (forRevision omitted), the
 * recap writer passes the revision its job started from. The write is refused (null) once the script has moved on,
 * so a slow recap never claims a newer script. The recap's own revision moves when its text changes; the revision
 * the recap now has is returned.
 */
export function writeRecap(id: number, text: string, forRevision?: number, tx: Db = db): number | null {
  const row = tx
    .select({ scriptRevision: episodes.scriptRevision, recap: episodes.recap, recapRevision: episodes.recapRevision })
    .from(episodes)
    .where(eq(episodes.id, id))
    .get();
  if (!row) throw notFound('Episode');
  const revision = forRevision ?? row.scriptRevision;
  const recapRevision = row.recap === text ? row.recapRevision : row.recapRevision + 1;
  const result = tx
    .update(episodes)
    .set({ recap: text, recapScriptRevision: revision, recapRevision })
    .where(and(eq(episodes.id, id), eq(episodes.scriptRevision, revision)))
    .run();
  return result.changes > 0 ? recapRevision : null;
}

/** The jobs that write the script, and those that work from it as they read it at their start. */
const SCRIPT_WRITERS = {
  rewrite: 'The script is being rewritten',
  write: 'The script is being written from its beats',
} as const;
const SCRIPT_READERS = {
  breakdown: 'The storyboard is being broken down from the script',
  extraction: 'Assets are being extracted from the script',
} as const;

/**
 * Nothing is writing the script (adr-0015): a 409 naming the running rewrite or write, with `action` saying what to
 * do once it is saved. Checked before reading the script or its source (a breakdown, an extraction, a source edit).
 */
export function assertScriptSettled(id: number, action: string) {
  const running = runningJobKinds(id);
  for (const kind of ['rewrite', 'write'] as const) {
    if (running.has(kind)) throw conflict(`${SCRIPT_WRITERS[kind]}; ${action} once it is saved`);
  }
}

/**
 * The script may change: nothing writes it and nothing works from it. A breakdown or an extraction keeps the script
 * it read, so a script changed under it would leave shots or assets that no longer match. `except` is the writer the
 * caller is about to start; its own duplicate is runJob's business. Recaps are pinned to a revision instead.
 */
export function assertScriptFree(id: number, action: string, except?: keyof typeof SCRIPT_WRITERS) {
  const running = runningJobKinds(id);
  for (const kind of ['rewrite', 'write'] as const) {
    if (kind !== except && running.has(kind)) throw conflict(`${SCRIPT_WRITERS[kind]}; ${action} once it is saved`);
  }
  for (const kind of ['breakdown', 'extraction'] as const) {
    if (running.has(kind)) throw conflict(`${SCRIPT_READERS[kind]}; ${action} once that is done`);
  }
}

/** The guards the creator's and an assistant's text saves share: no agent is writing or reading the text. */
function assertEditable(id: number, part: EpisodeTextPart) {
  if (part === 'script') assertScriptFree(id, 'edit it');
  else if (part === 'beats') assertScriptSettled(id, 'edit the source text');
  else if (getEpisodeJobs(id).recap?.status === 'running') throw conflict('The recap is being written; edit it once it is saved');
}

/** `2026-10-09 14:02` from an ISO timestamp, for refusal texts. */
export const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');

/** `a script (4 210 characters), 12 shots and a film`. */
const listOf = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/**
 * The replace guard (adr-0016): a run or a copy that would overwrite a saved script refuses until it is called with
 * `replace`, naming what the episode holds so the caller can tell the creator. This protects against a model that did
 * not read first; the creator's agreement is the caller's business (the studio's confirmation, the conversation).
 */
export function assertScriptReplaceable(row: Row, replace: boolean | undefined) {
  const script = row.scriptContent?.trim() ?? '';
  if (replace || !script) return;
  const recapStatus: RecapStatus = !row.recap.trim() ? 'missing' : isRecapStale(row) ? 'stale' : 'ready';
  throw precondition(
    `Episode ${row.episodeNumber} already has a script (${script.length} characters, revision ${row.scriptRevision}, changed ${when(row.updatedAt)}, recap ${recapStatus}). Replacing it makes the recap stale and the storyboard outdated. Call again with replace: true once the creator has agreed.`,
    { scriptChars: script.length, scriptRevision: row.scriptRevision, changedAt: row.updatedAt, recapStatus },
  );
}

/**
 * Field-based dispatch of UpdateEpisodeContent, SaveScript, SaveRecap, SetEpisodeResolution, SetEpisodeTargetDuration
 * and SetEpisodeStatus.
 * A patch carrying both the script and the recap writes the script first, so the recap is pinned to the new revision.
 * The script, its source and the recap are refused while an agent is writing from or to them: the agent's save would
 * silently replace the creator's text (the same rule as creator shot commands during a breakdown).
 */
export function updateEpisode(id: number, input: z.output<typeof UpdateEpisode>): EpisodeView {
  const row = getEpisodeRow(id);
  assertSomething(input);
  const { content, scriptContent, recap, ...rest } = input;
  if (scriptContent !== undefined) assertEditable(id, 'script');
  else if (content !== undefined) assertEditable(id, 'beats');
  if (recap !== undefined) assertEditable(id, 'recap');
  db.transaction((tx) => {
    if (Object.keys(rest).length > 0) tx.update(episodes).set(rest).where(eq(episodes.id, id)).run();
    if (content !== undefined) writeBeats(id, content, tx);
    if (scriptContent !== undefined) writeScript(id, scriptContent, tx);
    if (recap !== undefined) writeRecap(id, recap, undefined, tx);
  });
  touchDrama(row.dramaId);
  return getEpisodeView(id);
}

export interface TextSaved {
  revision: number;
  characters: number;
  changed: boolean;
}

/** The revision a part is at, and its text, as one read. */
function partState(row: Pick<Row, 'content' | 'beatsRevision' | 'scriptContent' | 'scriptRevision' | 'recap' | 'recapRevision'>, part: EpisodeTextPart) {
  switch (part) {
    case 'beats':
      return { text: row.content, revision: row.beatsRevision };
    case 'script':
      return { text: row.scriptContent ?? '', revision: row.scriptRevision };
    case 'recap':
      return { text: row.recap, revision: row.recapRevision };
  }
}

/**
 * ReadEpisode's text of one part with the revision to pass back when saving it (adr-0016); the recap also carries the
 * script revision it is read against.
 */
export function readEpisodeText(id: number, part: EpisodeTextPart): TextSaved & { text: string; scriptRevision?: number } {
  const row = getEpisodeRow(id);
  const { text, revision } = partState(row, part);
  return { text, revision, characters: text.length, changed: false, ...(part === 'recap' ? { scriptRevision: row.scriptRevision } : {}) };
}

/**
 * SaveBeats, SaveScript and SaveRecap with a freshness token (adr-0016): the save happens only while the part is
 * still at the revision the caller read, checked inside the write transaction; otherwise CONFLICT names both
 * revisions. A recap may also name the script revision it was written for (`forScriptRevision`), and is refused
 * once the script moved on, so a recap of an older script is never pinned to a newer one. The same job guards as
 * the creator's edit apply.
 */
export function saveEpisodeText(id: number, part: EpisodeTextPart, text: string, ifRevision: number, forScriptRevision?: number): TextSaved {
  const row = getEpisodeRow(id);
  assertEditable(id, part);
  const saved = db.transaction((tx) => {
    const current = tx.select().from(episodes).where(eq(episodes.id, id)).get();
    if (!current) throw notFound('Episode');
    const before = partState(current, part);
    if (before.revision !== ifRevision) {
      throw conflict(`The ${PART_NAMES[part]} is at revision ${before.revision}; you read revision ${ifRevision}. Read it again before saving.`, {
        part,
        revision: before.revision,
        ifRevision,
      });
    }
    if (part === 'recap' && forScriptRevision !== undefined && forScriptRevision !== current.scriptRevision) {
      throw conflict(
        `The script is at revision ${current.scriptRevision}; the recap was read against revision ${forScriptRevision}. Read the episode again before saving a recap for it.`,
        { part, scriptRevision: current.scriptRevision, forScriptRevision },
      );
    }
    const revision =
      part === 'beats' ? writeBeats(id, text, tx) : part === 'script' ? writeScript(id, text, tx) : (writeRecap(id, text, undefined, tx) ?? before.revision);
    return { revision, characters: text.length, changed: before.text !== text };
  });
  touchDrama(row.dramaId);
  return saved;
}

/** What deleting the episode would lose: its script, its live shots, its film. */
function heldWork(row: Row): { items: string[]; details: { scriptChars: number; shots: number; film: boolean } } {
  const scriptChars = row.scriptContent?.trim().length ?? 0;
  const shotCount =
    db
      .select({ n: count() })
      .from(shots)
      .where(and(eq(shots.episodeId, row.id), isNull(shots.parkedByJobId)))
      .get()?.n ?? 0;
  const items = [
    scriptChars > 0 && `a script (${scriptChars} characters)`,
    shotCount > 0 && `${shotCount} ${shotCount === 1 ? 'shot' : 'shots'}`,
    !!row.filmPath && 'a film',
  ].filter((x): x is string => typeof x === 'string');
  return { items, details: { scriptChars, shots: shotCount, film: !!row.filmPath } };
}

/**
 * DeleteEpisode: soft delete. Refused while a job of the episode runs (it would go on writing under a deleted
 * episode) and, unless forced, when the episode holds a script, shots or a film, naming what would be lost
 * (adr-0016). The studio's confirmation dialog forces; an assistant asks the creator first.
 */
export function deleteEpisode(id: number, opts: { force?: boolean } = {}): { id: number } {
  const row = getEpisodeRow(id);
  if (runningJobKinds(id).size > 0) throw conflict('A job is still running on this episode; cancel it or let it finish, then delete the episode');
  if (!opts.force) {
    const held = heldWork(row);
    if (held.items.length > 0) {
      throw precondition(
        `Episode ${row.episodeNumber} holds ${listOf(held.items)}. Deleting it loses them; call again with force: true once the creator has agreed.`,
        held.details,
      );
    }
  }
  db.update(episodes).set({ deletedAt: new Date().toISOString() }).where(eq(episodes.id, id)).run();
  touchDrama(row.dramaId);
  return { id };
}

/**
 * SkipRewrite: the raw content becomes the script, so the skip is persisted and survives reloads. An existing script
 * is replaced only with `replace` (adr-0016). The recap chain is the caller's (useContentAsScript).
 */
export function skipRewrite(id: number, opts: { replace?: boolean } = {}): EpisodeView {
  const row = getEpisodeRow(id);
  if (!row.content.trim()) throw precondition('Paste the raw content before skipping the rewrite');
  assertScriptFree(id, 'use the raw content');
  assertScriptReplaceable(row, opts.replace);
  writeScript(id, row.content);
  touchDrama(row.dramaId);
  return getEpisodeView(id);
}

/** AttachEpisodeFilm: the latest rendered film becomes the episode's video (issued by compositing on completion). */
export function attachEpisodeFilm(tx: Tx, episodeId: number, filmPath: string, durationSeconds: number) {
  tx.update(episodes).set({ filmPath, filmDurationSeconds: durationSeconds }).where(eq(episodes.id, episodeId)).run();
}
