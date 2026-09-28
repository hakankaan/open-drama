import { Hono } from 'hono';
import {
  CreateCharacter,
  CreateProp,
  CreateScene,
  IdParam,
  UpdateCharacter,
  UpdateProp,
  UpdateScene,
} from '@open-drama/contracts';
import { created, ok } from '../../http/envelope';
import { v } from '../../http/validate';
import {
  createCharacter,
  createProp,
  createScene,
  deleteCharacter,
  deleteProp,
  deleteScene,
  getDramaAssets,
  getEpisodeAssets,
  updateCharacter,
  updateProp,
  updateScene,
} from './service';

const id = v('param', IdParam);

export const assetsRoutes = new Hono()
  .get('/dramas/:id/assets', id, (c) => ok(c, getDramaAssets(c.req.valid('param').id)))
  .get('/episodes/:id/assets', id, (c) => ok(c, getEpisodeAssets(c.req.valid('param').id)))
  .post('/characters', v('json', CreateCharacter), (c) => created(c, createCharacter(c.req.valid('json'))))
  .patch('/characters/:id', id, v('json', UpdateCharacter), (c) =>
    ok(c, updateCharacter(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/characters/:id', id, (c) => ok(c, deleteCharacter(c.req.valid('param').id)))
  .post('/scenes', v('json', CreateScene), (c) => created(c, createScene(c.req.valid('json'))))
  .patch('/scenes/:id', id, v('json', UpdateScene), (c) =>
    ok(c, updateScene(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/scenes/:id', id, (c) => ok(c, deleteScene(c.req.valid('param').id)))
  .post('/props', v('json', CreateProp), (c) => created(c, createProp(c.req.valid('json'))))
  .patch('/props/:id', id, v('json', UpdateProp), (c) => ok(c, updateProp(c.req.valid('param').id, c.req.valid('json'))))
  .delete('/props/:id', id, (c) => ok(c, deleteProp(c.req.valid('param').id)));
