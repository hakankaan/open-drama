import { env } from '../../../env';
import { aliyunVideo } from './aliyun-video';
import { geminiImage } from './gemini-image';
import { minimaxVideo } from './minimax-video';
import { openaiImage } from './openai-image';
import { stubImage } from './stub-image';
import { stubVideo } from './stub-video';
import type { ImageAdapter, VideoAdapter } from './types';
import { volcengineImage } from './volcengine-image';
import { volcengineVideo } from './volcengine-video';

const IMAGE: Record<string, ImageAdapter> = {
  openai: openaiImage,
  gemini: geminiImage,
  volcengine: volcengineImage,
};

const VIDEO: Record<string, VideoAdapter> = {
  volcengine: volcengineVideo,
  minimax: minimaxVideo,
  aliyun: aliyunVideo,
};

/** The image adapter for a provider. With OPEN_DRAMA_STUB_PROVIDERS=1 every provider is served offline. */
export function imageAdapterFor(provider: string): ImageAdapter | null {
  if (env.OPEN_DRAMA_STUB_PROVIDERS) return stubImage;
  return IMAGE[provider] ?? null;
}

/** The video adapter for a provider; offline with OPEN_DRAMA_STUB_PROVIDERS=1. */
export function videoAdapterFor(provider: string): VideoAdapter | null {
  if (env.OPEN_DRAMA_STUB_PROVIDERS) return stubVideo;
  return VIDEO[provider] ?? null;
}
