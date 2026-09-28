import type { AspectRatio } from '@open-drama/contracts';
import { parseDataUrl, joinProviderUrl } from './url';
import { ProviderError, type GenerateOutcome, type ImageAdapter } from './types';

const SIZE: Record<AspectRatio, string> = { '16:9': '1536x1024', '9:16': '1024x1536', '1:1': '1024x1024', adaptive: 'auto' };

function outcome(body: unknown): GenerateOutcome {
  const item = (body as { data?: { url?: string; b64_json?: string }[] }).data?.[0];
  if (item?.b64_json) return { kind: 'result', base64: { data: item.b64_json, mimeType: 'image/png' } };
  if (item?.url) return { kind: 'result', url: item.url };
  throw new ProviderError('The provider returned no image');
}

/**
 * OpenAI Images: /v1/images/generations for text-to-image, /v1/images/edits (multipart image[]) when reference
 * images are sent. gpt-image models answer with base64; URL answers are also handled.
 */
export const openaiImage: ImageAdapter = {
  provider: 'openai',
  limits: { images: 6 },
  buildGenerateRequest(config, record) {
    const headers = { Authorization: `Bearer ${config.apiKey}` };
    const size = config.model.startsWith('gpt-image') ? SIZE[record.aspectRatio] : '1024x1024';
    if (record.referenceImages.length === 0) {
      return {
        url: joinProviderUrl(config.baseUrl, '/v1', 'images/generations'),
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, prompt: record.prompt, n: 1, size }),
      };
    }
    const form = new FormData();
    form.set('model', config.model);
    form.set('prompt', record.prompt);
    form.set('size', size);
    record.referenceImages.forEach((dataUrl, i) => {
      const parsed = parseDataUrl(dataUrl);
      if (parsed) form.append('image[]', new Blob([Buffer.from(parsed.data, 'base64')], { type: parsed.mimeType }), `ref-${i}.jpg`);
    });
    return { url: joinProviderUrl(config.baseUrl, '/v1', 'images/edits'), method: 'POST', headers, body: form };
  },
  parseGenerateResponse: outcome,
};
