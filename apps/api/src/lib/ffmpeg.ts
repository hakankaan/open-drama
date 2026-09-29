import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { env } from '../env';

const require = createRequire(import.meta.url);

function bundledFfmpeg(): string | null {
  try {
    return (require('ffmpeg-static') as string | null) ?? null;
  } catch {
    return null;
  }
}

function bundledFfprobe(): string | null {
  try {
    return (require('ffprobe-static') as { path: string }).path;
  } catch {
    return null;
  }
}

export const ffmpegBin = (): string => env.FFMPEG_BIN ?? bundledFfmpeg() ?? 'ffmpeg';
export const ffprobeBin = (): string => env.FFPROBE_BIN ?? bundledFfprobe() ?? 'ffprobe';

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

const children = new Set<ChildProcess>();

/** Kills every binary still running (on shutdown), so no encoder outlives the process that owns its result. */
export function killRunning(): void {
  for (const child of children) child.kill('SIGKILL');
}

/** Spawns a binary with a timeout, capturing output. Never rejects on a non-zero exit; rejects on spawn failure. */
export function run(bin: string, args: string[], timeoutMs = 60_000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-20_000)));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      children.delete(child);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      children.delete(child);
      resolve({ code, stdout, stderr });
    });
  });
}

let available: boolean | null = null;

/** Probes both binaries with `-version`; a success is cached. */
export async function ffmpegAvailable(): Promise<boolean> {
  if (available) return true;
  try {
    const [a, b] = await Promise.all([run(ffmpegBin(), ['-version'], 10_000), run(ffprobeBin(), ['-version'], 10_000)]);
    available = a.code === 0 && b.code === 0;
  } catch {
    available = false;
  }
  return available;
}

/** Container duration in seconds via ffprobe, or null when the file is not a readable media file. */
export async function probeDurationSeconds(absPath: string): Promise<number | null> {
  try {
    const result = await run(ffprobeBin(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', absPath], 30_000);
    const seconds = Number(result.stdout.trim());
    return result.code === 0 && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

export interface ClipInfo {
  width: number;
  height: number;
  /** Average frame rate; null when the container does not report one. */
  fps: number | null;
  hasAudio: boolean;
  /** The picture's length (the video stream's, else the container's): audio is fitted to it, never the reverse. */
  durationSeconds: number;
}

const rate = (value: string | undefined) => {
  const [num, den] = (value ?? '').split('/').map(Number);
  const fps = den ? num! / den : num;
  return fps && Number.isFinite(fps) && fps > 0 ? fps : null;
};

/** Where the first video stream's last packet ends, read from packet timestamps (no decoding). */
async function pictureEnd(absPath: string): Promise<number | null> {
  const result = await run(
    ffprobeBin(),
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,duration_time', '-of', 'csv=p=0', absPath],
    30_000,
  );
  if (result.code !== 0) return null;
  let end = 0;
  for (const line of result.stdout.split('\n')) {
    const [pts, dur] = line.split(',').map(Number);
    if (Number.isFinite(pts)) end = Math.max(end, pts! + (Number.isFinite(dur) ? dur! : 0));
  }
  return end > 0 ? end : null;
}

/** The first video stream's geometry and rate, audio presence and duration; null when the file has no video stream. */
export async function probeClip(absPath: string): Promise<ClipInfo | null> {
  try {
    const result = await run(
      ffprobeBin(),
      ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,avg_frame_rate,duration:format=duration', '-of', 'json', absPath],
      30_000,
    );
    if (result.code !== 0) return null;
    const info = JSON.parse(result.stdout) as {
      streams?: { codec_type?: string; width?: number; height?: number; avg_frame_rate?: string; duration?: string }[];
      format?: { duration?: string };
    };
    const video = info.streams?.find((s) => s.codec_type === 'video' && s.width && s.height);
    const positive = (v: string | undefined) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
    if (!video) return null;
    // Containers such as WebM and MKV give no per-stream duration; the container's includes a longer audio tail.
    const durationSeconds = positive(video.duration) ?? (await pictureEnd(absPath)) ?? positive(info.format?.duration);
    if (durationSeconds === null) return null;
    return {
      width: video.width!,
      height: video.height!,
      fps: rate(video.avg_frame_rate),
      hasAudio: !!info.streams?.some((s) => s.codec_type === 'audio'),
      durationSeconds,
    };
  } catch {
    return null;
  }
}
