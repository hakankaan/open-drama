import { env } from '../../../env';
import { geminiImage } from './gemini-image';
import { openaiImage } from './openai-image';
import { stubImage } from './stub-image';
import type { ImageAdapter } from './types';
import { volcengineImage } from './volcengine-image';

const IMAGE: Record<string, ImageAdapter> = {
  openai: openaiImage,
  gemini: geminiImage,
  volcengine: volcengineImage,
};

/** The image adapter for a provider. With OPEN_DRAMA_STUB_PROVIDERS=1 every provider is served offline. */
export function imageAdapterFor(provider: string): ImageAdapter | null {
  if (env.OPEN_DRAMA_STUB_PROVIDERS) return stubImage;
  return IMAGE[provider] ?? null;
}
