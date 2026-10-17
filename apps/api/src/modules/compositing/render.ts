import { rm } from 'node:fs/promises';
import type { AspectRatio, DramaLook, Resolution } from '@open-drama/contracts';
import { ffmpegBin, run, type ClipInfo } from '../../lib/ffmpeg';
import { gradeFilter, type Grade } from './colour';

export const ENCODER = 'libx264 medium crf23 yuv420p · aac 48k stereo 192k · faststart';

/** Every film plays at 24 frames a second, whatever its clips were generated at. */
export const FPS = 24;

// Loudness target (EBU R128 for online video): integrated, true peak, range.
const LOUDNESS = 'I=-16:TP=-1.5:LRA=11';

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** A clip of the film and how long it plays: its picture length, or less when it overran the length it was asked for. */
export interface FilmClip {
  absPath: string;
  info: ClipInfo;
  seconds: number;
  /** Frames left out at its start: a clip that continues the one before opens on the frame that one ends on (adr-0020). */
  skip: number;
  /** Nudges the clip's colour towards its reference before it is fitted into the frame; null leaves it as it is. */
  grade: Grade | null;
}

export interface FilmOptions {
  /** The frame every clip is fitted into; null for the first clip's (a drama made with the adaptive shape). */
  frame: { width: number; height: number } | null;
  look: DramaLook;
}

/** A drama's frame at an episode's resolution: 16:9 at 720p is 1280×720. Null for adaptive (the first clip decides). */
export function filmFrame(aspect: AspectRatio, resolution: Resolution): FilmOptions['frame'] {
  const short = Number.parseInt(resolution, 10);
  const long = even((short * 16) / 9);
  if (aspect === '16:9') return { width: long, height: short };
  if (aspect === '9:16') return { width: short, height: long };
  if (aspect === '1:1') return { width: short, height: short };
  return null;
}

/** The series looks, laid over the joined picture. */
const LOOK: Record<Exclude<DramaLook, 'none'>, string> = {
  warm: 'colortemperature=temperature=5200:pl=0.6',
  cool: 'colortemperature=temperature=8200:pl=0.6',
  teal_orange: 'colorbalance=rs=-0.07:bs=0.08:rh=0.07:bh=-0.08,eq=saturation=1.06',
  faded: "curves=all='0/0.07 0.5/0.52 1/0.93',eq=saturation=0.82",
  mono: 'hue=s=0',
};

/**
 * The concat filter graph. Clips from different providers (or uploads) differ in size, frame rate and whether
 * they carry audio, which the concat demuxer cannot join; each clip is graded, fitted into the film's frame
 * (letterboxed, never cropped) at 24 fps. Each segment lasts exactly its clip's play length: the picture is held on
 * its last frame if it falls short and the stereo track is padded or cut to it (silence when there is none), so no
 * cut freezes on a trailing audio tail and sound stays in sync across the film. A clip that continues the one before
 * starts a frame in, past the frame both share. The look goes over the joined picture.
 */
function filterGraph(clips: FilmClip[], options: FilmOptions): string {
  const first = clips[0]!.info;
  const w = options.frame?.width ?? even(first.width);
  const h = options.frame?.height ?? even(first.height);
  const parts: string[] = [];
  clips.forEach(({ info: clip, seconds, skip, grade }, i) => {
    const d = seconds.toFixed(3);
    const skipVideo = skip ? `trim=start_frame=${skip},setpts=PTS-STARTPTS,` : '';
    const skipAudio = skip ? `atrim=start=${(skip / FPS).toFixed(3)},asetpts=PTS-STARTPTS,` : '';
    parts.push(
      `[${i}:v:0]${grade ? `${gradeFilter(grade)},` : ''}` +
        `scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,` +
        `setsar=1,fps=${FPS},format=yuv420p,${skipVideo}tpad=stop=-1:stop_mode=clone,trim=duration=${d},setpts=PTS-STARTPTS[v${i}]`,
    );
    parts.push(
      clip.hasAudio
        ? `[${i}:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,${skipAudio}apad,atrim=duration=${d},asetpts=PTS-STARTPTS[a${i}]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${d}[a${i}]`,
    );
  });
  const look = options.look === 'none' ? '' : `${LOOK[options.look]},format=yuv420p,`;
  parts.push(`${clips.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${clips.length}:v=1:a=1[joined][a]`);
  parts.push(`[joined]${look}null[v]`);
  return parts.join(';');
}

async function ffmpeg(args: string[], timeoutMs: number, what: string) {
  const result = await run(ffmpegBin(), ['-y', '-nostdin', '-hide_banner', '-nostats', ...args], timeoutMs, { killOnShutdown: true });
  if (result.code !== 0) {
    const tail = result.stderr.trim().split('\n').slice(-6).join('\n');
    throw new Error(result.code === null ? `FFmpeg timed out while ${what}` : `FFmpeg failed: ${tail}`);
  }
  return result;
}

/** The film's measured loudness (loudnorm's first pass); null when it is silent, which loudnorm cannot raise. */
async function measureLoudness(absPath: string, timeoutMs: number): Promise<Record<string, string> | null> {
  const result = await ffmpeg(
    ['-i', absPath, '-map', '0:a:0', '-af', `loudnorm=${LOUDNESS}:print_format=json`, '-f', 'null', '-'],
    timeoutMs,
    'measuring the loudness',
  );
  const json = result.stderr.slice(result.stderr.lastIndexOf('{'), result.stderr.lastIndexOf('}') + 1);
  try {
    const measured = JSON.parse(json) as Record<string, string>;
    return Number.isFinite(Number(measured.input_i)) && Number.isFinite(Number(measured.input_thresh)) ? measured : null;
  } catch {
    return null;
  }
}

/**
 * Renders the clips, in the given order, into one H.264/AAC MP4 with faststart, in three passes: the picture and an
 * uncompressed mix, the mix's loudness, then the final file with the picture copied and the mix brought to -16 LUFS
 * (two-pass loudnorm, linear). Each pass may take ten times real time (at least ten minutes). Throws with the tail of
 * FFmpeg's stderr; the intermediate file is removed either way.
 */
export async function renderFilm(inputs: FilmClip[], options: FilmOptions, outAbs: string): Promise<void> {
  const total = inputs.reduce((sum, c) => sum + c.seconds, 0);
  const timeout = Math.max(10 * 60_000, total * 10_000);
  const mixAbs = `${outAbs}.mix.mkv`;
  try {
    await ffmpeg(
      [
        ...inputs.flatMap((c) => ['-i', c.absPath]),
        '-filter_complex', filterGraph(inputs, options),
        '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
        '-c:a', 'pcm_s16le', '-ar', '48000',
        mixAbs,
      ],
      timeout,
      'rendering the film',
    );
    const m = await measureLoudness(mixAbs, timeout);
    const level = m
      ? `loudnorm=${LOUDNESS}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:` +
        `measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`
      : 'anull';
    await ffmpeg(
      [
        '-i', mixAbs,
        '-map', '0:v:0', '-map', '0:a:0',
        '-c:v', 'copy',
        '-af', level,
        '-c:a', 'aac', '-ar', '48000', '-b:a', '192k',
        '-movflags', '+faststart',
        outAbs,
      ],
      timeout,
      'levelling the sound',
    );
  } finally {
    await rm(mixAbs, { force: true });
  }
}
