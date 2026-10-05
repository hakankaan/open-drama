import { Hono } from 'hono';
import { EpisodeGenerationTasksQuery, GenerationTaskListQuery, IdParam, VideoCapsQuery } from '@open-drama/contracts';
import { ok } from '../../http/envelope';
import { v } from '../../http/validate';
import { getEpisodeRow } from '../production/episodes';
import { videoCapsOf } from './engine/videos';
import { deleteTask, episodeGenerationTasks, getTask, listTasks } from './tasks';

const id = v('param', IdParam);

export const generationRoutes = new Hono()
  .get('/generation-tasks', v('query', GenerationTaskListQuery), (c) => ok(c, listTasks(c.req.valid('query'))))
  .get('/generation-tasks/:id', id, (c) => ok(c, getTask(c.req.valid('param').id)))
  .delete('/generation-tasks/:id', id, (c) => ok(c, deleteTask(c.req.valid('param').id)))
  .get('/episodes/:id/generation-tasks', id, v('query', EpisodeGenerationTasksQuery), (c) => {
    const ep = getEpisodeRow(c.req.valid('param').id);
    return ok(c, episodeGenerationTasks(ep.id, c.req.valid('query').limit));
  })
  // What a video model accepts, for the studio's pickers: read from the provider where the adapter can.
  .get('/video-models/caps', v('query', VideoCapsQuery), async (c) => {
    const { provider, model } = c.req.valid('query');
    return ok(c, await videoCapsOf(provider, model));
  });
