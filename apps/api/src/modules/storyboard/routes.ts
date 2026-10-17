import { Hono } from 'hono';
import {
  CheckShot,
  CreateShot,
  IdParam,
  RequestLineAudio,
  RequestLipSync,
  RequestShotKeyframe,
  RequestShotVideo,
  StartVideoPromptBatch,
  TextModelOverride,
  UpdateShot,
} from '@open-drama/contracts';
import { created, ok } from '../../http/envelope';
import { v } from '../../http/validate';
import { startBreakdown } from '../agents/services/breakdown';
import { generateShotVideoPrompt, startVideoPromptBatch } from '../agents/services/video-prompts';
import { shotVideos } from '../generation/tasks';
import { createShot, deleteShot, getEpisodeShots, getShotRow, updateShot } from './service';
import { requestShotKeyframe } from './keyframe';
import { checkShot } from './qa';
import { requestShotVideo } from './video';
import { requestLineAudio, requestLipSync, speechVoices } from './voice';

const id = v('param', IdParam);

export const storyboardRoutes = new Hono()
  .get('/episodes/:id/shots', id, (c) => ok(c, getEpisodeShots(c.req.valid('param').id)))
  .post('/episodes/:id/breakdown', id, v('json', TextModelOverride.default({})), async (c) =>
    ok(c, await startBreakdown(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/episodes/:id/video-prompts', id, v('json', StartVideoPromptBatch.default({})), (c) =>
    ok(c, startVideoPromptBatch(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/shots', v('json', CreateShot), (c) => created(c, createShot(c.req.valid('json'))))
  .patch('/shots/:id', id, v('json', UpdateShot), (c) => ok(c, updateShot(c.req.valid('param').id, c.req.valid('json'))))
  .delete('/shots/:id', id, (c) => ok(c, deleteShot(c.req.valid('param').id)))
  .post('/shots/:id/video-prompt', id, v('json', TextModelOverride.default({})), async (c) =>
    ok(c, { videoPrompt: await generateShotVideoPrompt(c.req.valid('param').id, c.req.valid('json')) }),
  )
  .post('/shots/:id/video', id, v('json', RequestShotVideo.default({})), async (c) =>
    ok(c, await requestShotVideo(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/shots/:id/keyframe', id, v('json', RequestShotKeyframe.default({})), (c) =>
    ok(c, requestShotKeyframe(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/shots/:id/line-audio', id, v('json', RequestLineAudio.default({})), async (c) =>
    ok(c, await requestLineAudio(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/shots/:id/lip-sync', id, v('json', RequestLipSync.default({})), (c) =>
    ok(c, requestLipSync(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/shots/:id/qa', id, v('json', CheckShot.default({})), async (c) =>
    ok(c, await checkShot(c.req.valid('param').id, c.req.valid('json'))),
  )
  .get('/speech/voices', async (c) => ok(c, await speechVoices()))
  .get('/shots/:id/videos', id, (c) => {
    const shot = getShotRow(c.req.valid('param').id);
    return ok(c, shotVideos(shot.id, shot.videoPath));
  });
