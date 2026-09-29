import type { AspectRatio } from '@open-drama/contracts';
import { ConfigError } from '../engine/errors';
import { joinProviderUrl } from './url';
import { ProviderError, type VideoAdapter } from './types';

interface BaseResp {
  status_code?: number;
  status_msg?: string;
}
interface MiniMaxTask {
  status?: 'queued' | 'preparing' | 'processing' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  content?: { url?: string };
  error?: { code?: string; message?: string } | string;
}

// MiniMax reports errors in base_resp with HTTP 200; these codes need a specific class.
const AUTH_CODES = new Set([1004, 2049]);
const MODERATION_CODES = new Set([1026, 1027]);

/** Throws on a non-zero base_resp, carrying a status the engine classifies (auth, quota, moderation). */
function checkBaseResp(body: unknown) {
  const resp = (body as { base_resp?: BaseResp }).base_resp;
  if (!resp?.status_code) return;
  const code = resp.status_code;
  const message = resp.status_msg || `MiniMax error ${code}`;
  if (AUTH_CODES.has(code)) throw new ProviderError(message, 401, String(code));
  if (code === 1002 || code === 1008) throw new ProviderError(message, 429, String(code));
  if (MODERATION_CODES.has(code)) throw new ProviderError(`${message} (sensitive content)`, 400, String(code));
  throw new ProviderError(message, 400, String(code));
}

const RATIOS = new Set<AspectRatio>(['16:9', '9:16', '1:1']);

/** The adapter speaks /v2; a base saved with the older /v1 path (the earlier preset) is read as the bare host. */
export const minimaxBase = (baseUrl: string) => baseUrl.replace(/\/v1\/?$/, '');

/**
 * MiniMax Hailuo H3 (/v2): one multimodal task (`content[]`: text, reference images, videos, audio), polled by
 * task id. Tiers are 768P and 2K: 480p and 720p go as 768P, 1080p as 2K. It has no reference token syntax, so
 * mentions stay plain names.
 */
export const minimaxVideo: VideoAdapter = {
  provider: 'minimax',
  // Submits answer with a task id; two minutes covers uploading inline reference images on a slow link.
  submitTimeoutMs: 120_000,
  formatMention: (_slot, name) => name,
  buildGenerateRequest(config, record) {
    if (!record.prompt) throw new ConfigError('MiniMax needs a text prompt');
    const content: unknown[] = [{ type: 'text', text: record.prompt.slice(0, 7000) }];
    for (const url of record.referenceImages) content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' });
    for (const url of record.referenceVideos) content.push({ type: 'video_url', video_url: { url }, role: 'reference_video' });
    for (const url of record.referenceAudios) content.push({ type: 'audio_url', audio_url: { url } });
    return {
      url: joinProviderUrl(minimaxBase(config.baseUrl), '/v2', 'video_generation'),
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        content,
        duration: record.durationSeconds,
        resolution: record.resolution === '1080p' ? '2K' : '768P',
        ratio: RATIOS.has(record.aspectRatio) ? record.aspectRatio : '16:9',
      }),
    };
  },
  parseGenerateResponse(body) {
    checkBaseResp(body);
    const id = (body as { task_id?: string | number }).task_id;
    if (id) return { kind: 'async', providerTaskId: String(id) };
    throw new ProviderError('The provider returned no task id');
  },
  buildPollRequest(config, providerTaskId) {
    return {
      url: joinProviderUrl(minimaxBase(config.baseUrl), '/v2', `query/video_generation/${encodeURIComponent(providerTaskId)}`),
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    };
  },
  parsePollResponse(body) {
    checkBaseResp(body);
    const task = ((body as { task?: MiniMaxTask }).task ?? body) as MiniMaxTask;
    if (task.status === 'succeeded') {
      return task.content?.url ? { status: 'completed', url: task.content.url } : { status: 'failed', error: 'The task succeeded without a video URL' };
    }
    if (task.status === 'failed' || task.status === 'cancelled') {
      const err = task.error;
      return typeof err === 'string'
        ? { status: 'failed', error: err }
        : { status: 'failed', error: err?.message || `The video task ended as ${task.status}`, code: err?.code };
    }
    return { status: 'pending' };
  },
};
