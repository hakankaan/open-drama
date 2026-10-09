import { Hono } from 'hono';
import {
  CreateDrama,
  CreateEpisode,
  DramaListQuery,
  IdParam,
  PlanEpisodes,
  TextModelOverride,
  UpdateDrama,
  UpdateEpisode,
} from '@open-drama/contracts';
import { created, ok } from '../../http/envelope';
import { v } from '../../http/validate';
import { getDramaJobs, getEpisodeJobs } from '../jobs/run-job';
import { createDrama, deleteDrama, getDramaDetail, getDramaRow, getDramaStats, listDramas, updateDrama } from './dramas';
import {
  createEpisode,
  deleteEpisode,
  getEpisodeRow,
  getEpisodeView,
  skipRewrite,
  updateEpisode,
} from './episodes';
import { startOutline } from '../agents/services/outline';
import { startPlan } from '../agents/services/plan';
import { maybeStartRecap, startRecap } from '../agents/services/recap';
import { startRewrite } from '../agents/services/rewrite';
import { startWrite } from '../agents/services/write';
import { getPipelineStatus } from './pipeline';

export const productionRoutes = new Hono()
  .get('/dramas', v('query', DramaListQuery), (c) => ok(c, listDramas(c.req.valid('query'))))
  .get('/dramas/stats', (c) => ok(c, getDramaStats()))
  .post('/dramas', v('json', CreateDrama), (c) => created(c, createDrama(c.req.valid('json'))))
  .get('/dramas/:id', v('param', IdParam), (c) => ok(c, getDramaDetail(c.req.valid('param').id)))
  .patch('/dramas/:id', v('param', IdParam), v('json', UpdateDrama), (c) =>
    ok(c, updateDrama(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/dramas/:id', v('param', IdParam), (c) => ok(c, deleteDrama(c.req.valid('param').id)))
  .get('/dramas/:id/jobs', v('param', IdParam), (c) => {
    const { id } = c.req.valid('param');
    getDramaRow(id);
    return ok(c, getDramaJobs(id));
  })
  .post('/dramas/:id/outline', v('param', IdParam), v('json', TextModelOverride.default({})), (c) =>
    ok(c, startOutline(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/dramas/:id/plan', v('param', IdParam), v('json', PlanEpisodes), (c) =>
    ok(c, startPlan(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/episodes', v('json', CreateEpisode), (c) => created(c, createEpisode(c.req.valid('json'))))
  .get('/episodes/:id', v('param', IdParam), (c) => ok(c, getEpisodeView(c.req.valid('param').id)))
  .patch('/episodes/:id', v('param', IdParam), v('json', UpdateEpisode), (c) =>
    ok(c, updateEpisode(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/episodes/:id', v('param', IdParam), (c) => ok(c, deleteEpisode(c.req.valid('param').id)))
  .post('/episodes/:id/rewrite', v('param', IdParam), v('json', TextModelOverride.default({})), (c) =>
    ok(c, startRewrite(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/episodes/:id/write', v('param', IdParam), v('json', TextModelOverride.default({})), (c) =>
    ok(c, startWrite(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/episodes/:id/skip-rewrite', v('param', IdParam), (c) => {
    const { id } = c.req.valid('param');
    const episode = skipRewrite(id);
    maybeStartRecap(id);
    return ok(c, episode);
  })
  .post('/episodes/:id/recap', v('param', IdParam), v('json', TextModelOverride.default({})), (c) =>
    ok(c, startRecap(c.req.valid('param').id, c.req.valid('json'))),
  )
  .get('/episodes/:id/pipeline-status', v('param', IdParam), (c) =>
    ok(c, getPipelineStatus(c.req.valid('param').id)),
  )
  .get('/episodes/:id/jobs', v('param', IdParam), (c) => {
    const { id } = c.req.valid('param');
    getEpisodeRow(id);
    return ok(c, getEpisodeJobs(id));
  });
