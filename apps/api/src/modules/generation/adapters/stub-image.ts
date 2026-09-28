import sharp from 'sharp';
import type { AspectRatio } from '@open-drama/contracts';
import { ProviderError, type ImageAdapter } from './types';

const SIZE: Record<AspectRatio, [number, number]> = {
  '16:9': [960, 540],
  '9:16': [540, 960],
  '1:1': [720, 720],
  adaptive: [800, 600],
};

const escape = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

function wrap(text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
      if (lines.length === maxLines) break;
    } else line += ' ' + w;
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  return lines;
}

/** A placeholder frame: a gradient in a hue derived from the task id, a title line and the wrapped prompt. */
export async function renderPlaceholder(title: string, prompt: string, aspectRatio: AspectRatio, taskId: number): Promise<Buffer> {
  const [w, h] = SIZE[aspectRatio];
  const hue = (taskId * 67) % 360;
  const lines = wrap(prompt, Math.floor(w / 13), Math.floor((h - 120) / 26));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},45%,32%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},50%,18%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="32" y="56" font-family="sans-serif" font-size="28" font-weight="700" fill="#fff">${escape(title)}</text>
    ${lines.map((l, i) => `<text x="32" y="${104 + i * 26}" font-family="sans-serif" font-size="18" fill="#ffffffcc">${escape(l)}</text>`).join('')}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Offline adapters wait a little, and reject a prompt containing #fail as moderation to exercise the failure path. */
export async function stubDelayOrFail(prompt: string) {
  await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
  if (prompt.includes('#fail')) {
    throw new ProviderError('The provider flagged this prompt as sensitive content (stub moderation)', 400, 'SensitiveContent');
  }
}

/** Offline image adapter (OPEN_DRAMA_STUB_PROVIDERS=1): after a short delay, a placeholder PNG with the prompt baked in. */
export const stubImage: ImageAdapter = {
  provider: 'stub',
  limits: { images: 6 },
  async generateLocal(record) {
    await stubDelayOrFail(record.prompt);
    const png = await renderPlaceholder(`STUB IMAGE, task ${record.taskId}`, record.prompt, record.aspectRatio, record.taskId);
    return { kind: 'result', base64: { data: png.toString('base64'), mimeType: 'image/png' } };
  },
};
