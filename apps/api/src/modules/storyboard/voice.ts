import { existsSync } from 'node:fs';
import { and, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import type { RequestLineAudio, RequestLipSync, SpeechVoices, TaskStarted } from '@open-drama/contracts';
import { db } from '../../db/client';
import { characters } from '../../db/schema';
import { ApiError, precondition } from '../../http/errors';
import { toAbsolute } from '../../lib/paths';
import { getAppSettings } from '../configuration/settings';
import { resolveLipSync, submitLipSync } from '../generation/engine/lipsync';
import { resolveSpeech, speechVoicesOf, submitSpeech } from '../generation/engine/speech';
import { touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { assertNoBreakdown, getShotRow } from './service';

/**
 * What the default speech service reads lines in (adr-0021): its model's voices and whether it clones a sample; no
 * model and no voices without a usable speech service.
 */
export async function speechVoices(): Promise<SpeechVoices> {
  let resolved;
  try {
    resolved = resolveSpeech({});
  } catch (err) {
    if (err instanceof ApiError && err.code === 'PRECONDITION_FAILED') return { model: null, voices: [], cloning: false };
    throw err;
  }
  const { voices, cloning } = await speechVoicesOf(resolved);
  return { model: resolved.model, voices, cloning };
}

/**
 * RequestLineAudio (adr-0021): the shot's line in its speaker's voice, in the content language. A voice sample is
 * cloned where the model clones; otherwise the speaker's named voice must be one of the model's (412), and a speaker
 * with neither is refused (412). The stored audio becomes the shot's line audio and grows the shot to hold it.
 */
export async function requestLineAudio(shotId: number, body: z.output<typeof RequestLineAudio>): Promise<TaskStarted> {
  const resolved = resolveSpeech({ explicitId: body.speechServiceId, model: body.model });
  const info = await speechVoicesOf(resolved);
  // Reading the model's voices can take seconds: the shot is read, and checked, after it.
  const shot = getShotRow(shotId);
  const ep = getEpisodeRow(shot.episodeId);
  assertNoBreakdown(ep.id);
  const line = shot.line.trim();
  if (!line) throw precondition('Write the shot’s line first');
  if (shot.speakerId === null) throw precondition('Pick who speaks the shot’s line first');
  const speaker = db
    .select()
    .from(characters)
    .where(and(eq(characters.id, shot.speakerId), isNull(characters.deletedAt)))
    .get();
  if (!speaker) throw precondition('The shot’s speaker was deleted; pick another');
  const cloned = Boolean(speaker.voiceSamplePath && info.cloning);
  if (cloned && !existsSync(toAbsolute(speaker.voiceSamplePath!))) {
    throw precondition(`${speaker.name}’s voice sample is missing; upload it again`);
  }
  if (!cloned) {
    if (!speaker.voice) {
      throw precondition(
        speaker.voiceSamplePath
          ? `${resolved.model} cannot clone ${speaker.name}’s voice sample; pick one of its voices for ${speaker.name}`
          : `Give ${speaker.name} a voice, or a voice sample, first`,
      );
    }
    // A model without a voice input would read every character in its one default voice.
    if (!info.named) {
      throw precondition(
        info.cloning
          ? `${resolved.model} takes no named voice; upload a voice sample of ${speaker.name} for it to clone`
          : `${resolved.model} takes neither a named voice nor a sample to clone; pick another speech model`,
      );
    }
    if (info.voices.length > 0 && !info.voices.includes(speaker.voice)) {
      throw precondition(`${speaker.voice} is not one of ${resolved.model}’s voices; pick another for ${speaker.name}`);
    }
  }
  const taskId = submitSpeech(resolved, {
    shotId: shot.id,
    dramaId: ep.dramaId,
    line,
    speakerId: speaker.id,
    voice: speaker.voice,
    voiceSamplePath: speaker.voiceSamplePath,
    cloned,
    language: getAppSettings().contentLanguage,
  });
  touchDrama(ep.dramaId);
  return { taskId };
}

/** RequestLipSync (adr-0021): the shot's current video re-synced to its line audio; the result becomes the current video. */
export function requestLipSync(shotId: number, body: z.output<typeof RequestLipSync>): TaskStarted {
  const resolved = resolveLipSync({ explicitId: body.lipsyncServiceId, model: body.model });
  const shot = getShotRow(shotId);
  const ep = getEpisodeRow(shot.episodeId);
  assertNoBreakdown(ep.id);
  const taskId = submitLipSync(resolved, shot, ep.dramaId, { auto: false });
  touchDrama(ep.dramaId);
  return { taskId };
}
