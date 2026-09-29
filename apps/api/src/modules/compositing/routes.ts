import { Hono } from 'hono';
import { IdParam, MergeShots } from '@open-drama/contracts';
import { ok } from '../../http/envelope';
import { v } from '../../http/validate';
import { episodeFilms, latestFilm, mergeShots } from './films';

const id = v('param', IdParam);

export const compositingRoutes = new Hono()
  .post('/episodes/:id/merge', id, v('json', MergeShots.default({})), async (c) =>
    ok(c, await mergeShots(c.req.valid('param').id, c.req.valid('json'))),
  )
  .get('/episodes/:id/films', id, (c) => ok(c, episodeFilms(c.req.valid('param').id)))
  .get('/episodes/:id/films/latest', id, (c) => ok(c, latestFilm(c.req.valid('param').id)));
