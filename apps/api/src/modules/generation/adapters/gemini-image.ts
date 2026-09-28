import { parseDataUrl, joinProviderUrl } from './url';
import { ProviderError, type ImageAdapter } from './types';

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { thought?: boolean; inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

/** Gemini image models: generateContent with an image response; the result arrives inline as base64. */
export const geminiImage: ImageAdapter = {
  provider: 'gemini',
  limits: { images: 6 },
  buildGenerateRequest(config, record) {
    const parts: unknown[] = [{ text: record.prompt }];
    for (const ref of record.referenceImages) {
      const parsed = parseDataUrl(ref);
      if (parsed) parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } });
    }
    return {
      url: joinProviderUrl(config.baseUrl, '/v1beta', `models/${encodeURIComponent(config.model)}:generateContent`),
      method: 'POST',
      headers: { 'x-goog-api-key': config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          ...(record.aspectRatio !== 'adaptive' ? { imageConfig: { aspectRatio: record.aspectRatio } } : {}),
        },
      }),
    };
  },
  parseGenerateResponse(body) {
    const res = body as GeminiResponse;
    if (res.promptFeedback?.blockReason) {
      throw new ProviderError(`The provider blocked the prompt (${res.promptFeedback.blockReason})`, 400, 'SAFETY');
    }
    const candidate = res.candidates?.[0];
    // Thinking models send interim images marked `thought`; the final image is the last unmarked one.
    const finals = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.inlineData ?? (part.inline_data && { mimeType: part.inline_data.mime_type, data: part.inline_data.data }))
      .filter((inline): inline is { mimeType: string; data: string } => !!inline?.data);
    const last = finals.at(-1);
    if (last) return { kind: 'result', base64: { data: last.data, mimeType: last.mimeType } };
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      throw new ProviderError(`The provider returned no image (${candidate.finishReason})`, 400, candidate.finishReason);
    }
    throw new ProviderError('The provider returned no image');
  },
};

