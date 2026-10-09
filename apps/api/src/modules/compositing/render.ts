import { ffmpegBin, run, type ClipInfo } from '../../lib/ffmpeg';

export const ENCODER = 'libx264 medium crf23 yuv420p · aac 48k stereo 192k · faststart';

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** A clip of the film and how long it plays: its picture length, or less when it overran the length it was asked for. */
export interface FilmClip {
  absPath: string;
  info: ClipInfo;
  seconds: number;
}

/**
 * The concat filter graph. Clips from different providers (or uploads) differ in size, frame rate and whether
 * they carry audio, which the concat demuxer cannot join; each clip is fitted into the first clip's frame
 * (letterboxed, never cropped) at its frame rate. Each segment lasts exactly its clip's play length: the picture
 * is held on its last frame if it falls short and the stereo track is padded or cut to it (silence when there is
 * none), so no cut freezes on a trailing audio tail and sound stays in sync across the film.
 */
function filterGraph(clips: FilmClip[]): string {
  const first = clips[0]!.info;
  const w = even(first.width);
  const h = even(first.height);
  const fps = Math.min(60, Math.max(1, Math.round((first.fps ?? 24) * 1000) / 1000));
  const parts: string[] = [];
  clips.forEach(({ info: clip, seconds }, i) => {
    const d = seconds.toFixed(3);
    parts.push(
      `[${i}:v:0]scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,` +
        `setsar=1,fps=${fps},format=yuv420p,tpad=stop=-1:stop_mode=clone,trim=duration=${d},setpts=PTS-STARTPTS[v${i}]`,
    );
    parts.push(
      clip.hasAudio
        ? `[${i}:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${d},asetpts=PTS-STARTPTS[a${i}]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${d}[a${i}]`,
    );
  });
  parts.push(`${clips.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${clips.length}:v=1:a=1[v][a]`);
  return parts.join(';');
}

/**
 * Renders the clips, in the given order, into one H.264/AAC MP4 with faststart. The timeout allows ten times real
 * time (at least ten minutes). Throws with the tail of FFmpeg's stderr.
 */
export async function renderFilm(inputs: FilmClip[], outAbs: string): Promise<void> {
  const total = inputs.reduce((sum, c) => sum + c.seconds, 0);
  const args = [
    '-y',
    '-nostdin',
    ...inputs.flatMap((c) => ['-i', c.absPath]),
    '-filter_complex', filterGraph(inputs),
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '48000', '-b:a', '192k',
    '-movflags', '+faststart',
    outAbs,
  ];
  const result = await run(ffmpegBin(), args, Math.max(10 * 60_000, total * 10_000));
  if (result.code !== 0) {
    const tail = result.stderr.trim().split('\n').slice(-6).join('\n');
    throw new Error(result.code === null ? 'FFmpeg timed out while rendering the film' : `FFmpeg failed: ${tail}`);
  }
}
