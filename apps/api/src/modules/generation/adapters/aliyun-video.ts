import { joinProviderUrl } from './url';
import { ProviderError, type VideoAdapter } from './types';

interface WanResponse {
  output?: {
    task_id?: string;
    task_status?: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';
    video_url?: string;
    code?: string;
    message?: string;
  };
  usage?: { output_video_duration?: number; duration?: number };
  code?: string;
  message?: string;
}

const reason = (res: WanResponse, fallback: string) => ({
  error: res.output?.message || res.message || fallback,
  code: res.output?.code || res.code,
});

/**
 * Alibaba Bailian Wan 3.x: an async video-synthesis task with `input.media[]` (typed references) and
 * `parameters`, polled through /tasks/{id}. Reference images are addressed in the prompt as 图N.
 */
export const aliyunVideo: VideoAdapter = {
  provider: 'aliyun',
  // Submits answer with a task id; two minutes covers uploading inline reference images on a slow link.
  submitTimeoutMs: 120_000,
  formatMention: (slot, name) => `${name}(图${slot})`,
  buildGenerateRequest(config, record) {
    const media = [
      ...record.referenceImages.map((url) => ({ type: 'reference_image', url })),
      ...record.referenceVideos.map((url) => ({ type: 'reference_video', url })),
      ...record.referenceAudios.map((url) => ({ type: 'reference_audio', url })),
    ];
    return {
      url: joinProviderUrl(config.baseUrl, '/api/v1', 'services/aigc/video-generation/video-synthesis'),
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' },
      body: JSON.stringify({
        model: config.model,
        input: { ...(record.prompt ? { prompt: record.prompt.slice(0, 20_000) } : {}), ...(media.length ? { media } : {}) },
        parameters: {
          resolution: record.resolution.toUpperCase(),
          ratio: record.aspectRatio,
          duration: record.durationSeconds,
          audio: record.generateAudio,
          prompt_extend: true,
          watermark: false,
        },
      }),
    };
  },
  parseGenerateResponse(body) {
    const res = body as WanResponse;
    if (res.output?.task_id) return { kind: 'async', providerTaskId: res.output.task_id };
    const { error, code } = reason(res, 'The provider returned no task id');
    throw new ProviderError(error, undefined, code);
  },
  buildPollRequest(config, providerTaskId) {
    return {
      url: joinProviderUrl(config.baseUrl, '/api/v1', `tasks/${encodeURIComponent(providerTaskId)}`),
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    };
  },
  parsePollResponse(body) {
    const res = body as WanResponse;
    switch (res.output?.task_status) {
      case 'SUCCEEDED':
        if (!res.output.video_url) return { status: 'failed', error: 'The task succeeded without a video URL' };
        return {
          status: 'completed',
          url: res.output.video_url,
          durationSeconds: res.usage?.output_video_duration ?? res.usage?.duration,
        };
      case 'FAILED':
      case 'CANCELED':
      case 'UNKNOWN':
        return { status: 'failed', ...reason(res, `The video task ended as ${res.output.task_status}`) };
      default:
        return { status: 'pending' };
    }
  },
};
