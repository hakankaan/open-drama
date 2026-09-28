import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../../../env';
import { ffmpegBin, run } from '../../../lib/ffmpeg';
import { toMediaPath } from '../../../lib/paths';
import { renderPlaceholder, stubDelayOrFail } from './stub-image';
import { ProviderError, type VideoAdapter } from './types';

/**
 * Offline video adapter (OPEN_DRAMA_STUB_PROVIDERS=1): a placeholder frame with the rendered prompt, looped by
 * FFmpeg into an H.264/AAC clip of the requested length. Mentions render as `Name [image N]` so the slot mapping
 * is visible in the frame. `#fail` in the prompt is rejected as moderation.
 */
export const stubVideo: VideoAdapter = {
  provider: 'stub',
  formatMention: (slot, name) => `${name} [image ${slot}]`,
  async generateLocal(record) {
    await stubDelayOrFail(record.prompt);
    const title = `STUB VIDEO, task ${record.taskId}, ${record.durationSeconds}s, ${record.resolution}, ${record.referenceImages.length} ref images`;
    const frame = join(env.storageRoot, 'temp', `${randomUUID()}.png`);
    const out = join(env.storageRoot, 'videos', `${randomUUID()}.mp4`);
    await writeFile(frame, await renderPlaceholder(title, record.prompt, record.aspectRatio, record.taskId));
    try {
      const result = await run(
        ffmpegBin(),
        [
          '-y', '-loop', '1', '-framerate', '12', '-i', frame,
          '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
          '-t', String(record.durationSeconds),
          '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', out,
        ],
        120_000,
      );
      if (result.code !== 0) throw new ProviderError(`The stub clip could not be encoded: ${result.stderr.slice(-300)}`);
    } finally {
      await rm(frame, { force: true });
    }
    return { kind: 'result', file: toMediaPath(out), durationSeconds: record.durationSeconds };
  },
};
