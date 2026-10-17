import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { env } from '../../../env';
import { ffmpegBin, run } from '../../../lib/ffmpeg';
import { toAbsolute, toMediaPath } from '../../../lib/paths';
import { stubDelayOrFail } from './stub-image';
import { ProviderError, type LipSyncAdapter, type SpeechAdapter } from './types';

/** The voices the offline speech model offers; it clones a recording too. */
const STUB_VOICES = ['Alto', 'Baritone', 'Soprano', 'Tenor'];

/**
 * Offline speech adapter (OPEN_DRAMA_STUB_PROVIDERS=1): a sine tone whose pitch comes from the voice (or the cloned
 * recording) and whose length grows with the text, about 15 characters a second, as AAC in an M4A file. `#fail` in
 * the text is rejected as moderation.
 */
export const stubSpeech: SpeechAdapter = {
  provider: 'stub',
  describeModel: async () => ({ named: true, voices: STUB_VOICES, cloning: true }),
  async generateLocal(record) {
    await stubDelayOrFail(record.text);
    const seconds = Math.min(20, Math.max(1, Math.round((record.text.trim().length / 15) * 10) / 10));
    const hz = 180 + (createHash('sha256').update(record.voiceSample ?? record.voice).digest().readUInt16BE(0) % 400);
    const out = join(env.storageRoot, 'audio', `${randomUUID()}.m4a`);
    const result = await run(
      ffmpegBin(),
      ['-y', '-f', 'lavfi', '-i', `sine=frequency=${hz}:sample_rate=44100:duration=${seconds}`, '-c:a', 'aac', '-b:a', '96k', out],
      60_000,
    );
    if (result.code !== 0) throw new ProviderError(`The stub speech could not be encoded: ${result.stderr.slice(-300)}`);
    return { kind: 'result', file: toMediaPath(out), durationSeconds: seconds };
  },
};

/**
 * Offline lip-sync adapter: the video with the speech laid over it and a green square in its corner, so a synced
 * version is told apart from its source at a glance.
 */
export const stubLipSync: LipSyncAdapter = {
  provider: 'stub',
  async generateLocal(record) {
    await stubDelayOrFail('');
    const out = join(env.storageRoot, 'videos', `${randomUUID()}.mp4`);
    const result = await run(
      ffmpegBin(),
      [
        '-y', '-i', toAbsolute(record.videoPath), '-i', toAbsolute(record.audioPath),
        '-map', '0:v:0', '-map', '1:a:0',
        '-vf', 'drawbox=x=iw-iw/12:y=ih-iw/12:w=iw/16:h=iw/16:color=lime@0.9:t=fill',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', out,
      ],
      120_000,
    );
    if (result.code !== 0) throw new ProviderError(`The stub lip sync could not be encoded: ${result.stderr.slice(-300)}`);
    return { kind: 'result', file: toMediaPath(out) };
  },
};
