import type { AspectRatio } from '@open-drama/contracts';
import { joinProviderUrl } from './url';
import { ProviderError, type ImageAdapter } from './types';

const SIZE: Record<AspectRatio, string> = {
  '16:9': '2560x1440',
  '9:16': '1440x2560',
  '1:1': '2048x2048',
  adaptive: '2304x1728',
};

/** Volcengine Ark Seedream: OpenAI-style /images/generations; reference images go in `image` as data URLs. */
export const volcengineImage: ImageAdapter = {
  provider: 'volcengine',
  limits: { images: 10 },
  buildGenerateRequest(config, record) {
    return {
      url: joinProviderUrl(config.baseUrl, '/api/v3', 'images/generations'),
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: record.prompt,
        size: SIZE[record.aspectRatio],
        response_format: 'url',
        watermark: false,
        ...(record.referenceImages.length > 0 ? { image: record.referenceImages } : {}),
      }),
    };
  },
  parseGenerateResponse(body) {
    const res = body as { data?: { url?: string; b64_json?: string }[]; error?: { message?: string; code?: string } };
    if (res.error) throw new ProviderError(res.error.message ?? 'The provider returned an error', 400, res.error.code);
    const item = res.data?.[0];
    if (item?.url) return { kind: 'result', url: item.url };
    if (item?.b64_json) return { kind: 'result', base64: { data: item.b64_json, mimeType: 'image/jpeg' } };
    throw new ProviderError('The provider returned no image');
  },
};
