import { ffmpegBin, run } from '../../lib/ffmpeg';

/** Per-channel (red, green, blue) mean and standard deviation, 0-255. */
export interface ColourStats {
  mean: [number, number, number];
  std: [number, number, number];
}

/** Per-channel gain and offset: out = (in - from) * gain + to. */
export type Grade = { from: number; gain: number; to: number }[];

const SIDE = 64;
const FRAMES = 24;

/**
 * Colour statistics of a still, or of a clip's first `seconds` sampled at 2 frames a second (at most 24 frames), read
 * from frames scaled down to 64×64 (area-averaged, so both sides of a match see the same level of detail). Null when
 * FFmpeg cannot read it.
 */
export async function colourStats(absPath: string, seconds: number | null): Promise<ColourStats | null> {
  const input = seconds === null ? ['-i', absPath] : ['-t', seconds.toFixed(3), '-i', absPath];
  const sample = seconds === null ? '' : 'fps=2,';
  const result = await run(
    ffmpegBin(),
    [
      '-v', 'error', '-nostdin', ...input, '-an', '-frames:v', String(seconds === null ? 1 : FRAMES),
      '-vf', `${sample}scale=${SIDE}:${SIDE}:flags=area,format=rgb24`, '-f', 'rawvideo', 'pipe:1',
    ],
    60_000,
  );
  const px = result.bytes;
  if (result.code !== 0 || px.length === 0 || px.length % (SIDE * SIDE * 3) !== 0) return null;
  const sum = [0, 0, 0];
  const sq = [0, 0, 0];
  const n = Math.floor(px.length / 3);
  for (let i = 0; i < n * 3; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = px[i + c]!;
      sum[c]! += v;
      sq[c]! += v * v;
    }
  }
  const mean = sum.map((s) => s / n) as ColourStats['mean'];
  const std = sq.map((s, c) => Math.sqrt(Math.max(0, s / n - mean[c]! ** 2))) as ColourStats['std'];
  return { mean, std };
}

// How far a clip moves towards its reference: half the way, and never more than these bounds. The reference is the
// still the clip was meant to start from, not a frame of it, so it sets a direction rather than a target.
const PULL = 0.5;
const MAX_SHIFT = 16;
const GAIN = [0.85, 1.15] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The damped, bounded grade that nudges a clip's colour towards its reference's. */
export function gradeTowards(clip: ColourStats, ref: ColourStats): Grade {
  return [0, 1, 2].map((c) => {
    const from = clip.mean[c]!;
    const spread = clip.std[c]! < 2 ? 1 : 1 + PULL * (ref.std[c]! / clip.std[c]! - 1);
    return { from, gain: clamp(spread, GAIN[0], GAIN[1]), to: from + clamp(PULL * (ref.mean[c]! - from), -MAX_SHIFT, MAX_SHIFT) };
  });
}

/** The grade as an 8-bit lutrgb filter. */
export function gradeFilter(grade: Grade): string {
  const [r, g, b] = grade.map(({ from, gain, to }) => `'clip((val-${from.toFixed(2)})*${gain.toFixed(4)}+${to.toFixed(2)},0,255)'`);
  return `format=rgb24,lutrgb=r=${r}:g=${g}:b=${b}`;
}
