import { spawn } from 'node:child_process';
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

/** Spawns a binary with a timeout, capturing output. Never rejects on a non-zero exit; rejects on spawn failure. */
export function run(bin: string, args: string[], timeoutMs = 60_000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-20_000)));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
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
