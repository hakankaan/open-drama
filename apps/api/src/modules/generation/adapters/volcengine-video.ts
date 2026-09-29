import { ConfigError } from '../engine/errors';
import { joinProviderUrl } from './url';
import { ProviderError, type VideoAdapter } from './types';

interface SeedanceTask {
  id?: string;
  status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  content?: { video_url?: string };
  duration?: number;
  error?: { code?: string; message?: string } | string;
}

const failure = (task: SeedanceTask) => {
  const err = task.error;
  if (typeof err === 'string') return { error: err };
  return { error: err?.message || `The video task ended as ${task.status}`, code: err?.code };
};

/**
 * Volcengine Ark Seedance 2.x: one multimodal task (`content[]` with the text, then reference images, videos and
 * audio by role), polled by task id. Seedance offers 480p and 720p; 1080p is sent as 720p.
 */
export const volcengineVideo: VideoAdapter = {
  provider: 'volcengine',
  // Submits answer with a task id; two minutes covers uploading inline reference images on a slow link.
  submitTimeoutMs: 120_000,
  formatMention: (slot, name) => `${name} (@Image${slot})`,
  buildGenerateRequest(config, record) {
    if (!/seedance/i.test(config.model)) {
      throw new ConfigError(`The Volcengine video adapter drives Seedance models; ${config.model} is not one`);
    }
    const content: unknown[] = [];
    if (record.prompt) content.push({ type: 'text', text: record.prompt });
    for (const url of record.referenceImages) content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' });
    for (const url of record.referenceVideos) content.push({ type: 'video_url', video_url: { url }, role: 'reference_video' });
    for (const url of record.referenceAudios) content.push({ type: 'audio_url', audio_url: { url }, role: 'reference_audio' });
    return {
      url: joinProviderUrl(config.baseUrl, '/api/v3', 'contents/generations/tasks'),
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        content,
        ratio: record.aspectRatio,
        duration: record.durationSeconds,
        resolution: record.resolution === '480p' ? '480p' : '720p',
        generate_audio: record.generateAudio,
        watermark: false,
      }),
    };
  },
  parseGenerateResponse(body) {
    const task = body as SeedanceTask;
    if (task.id) return { kind: 'async', providerTaskId: task.id };
    if (task.content?.video_url) return { kind: 'result', url: task.content.video_url };
    throw new ProviderError(failure(task).error || 'The provider returned no task id', undefined, failure(task).code);
  },
  buildPollRequest(config, providerTaskId) {
    return {
      url: joinProviderUrl(config.baseUrl, '/api/v3', `contents/generations/tasks/${encodeURIComponent(providerTaskId)}`),
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    };
  },
  parsePollResponse(body) {
    const task = body as SeedanceTask;
    if (task.status === 'succeeded') {
      if (!task.content?.video_url) return { status: 'failed', error: 'The task succeeded without a video URL' };
      return { status: 'completed', url: task.content.video_url, durationSeconds: task.duration };
    }
    if (task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired') {
      return { status: 'failed', ...failure(task) };
    }
    return { status: 'pending' };
  },
};
