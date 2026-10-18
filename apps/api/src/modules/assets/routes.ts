import { Hono } from 'hono';
import {
  AssetKind,
  CreateCharacter,
  CreateProp,
  CreateScene,
  DescribeAsset,
  GenerateFinalPrompt,
  IdParam,
  RequestAssetImage,
  RequestOutfitImage,
  StartDesign,
  StartExtraction,
  UpdateCharacter,
  UpdateEpisodeOutfit,
  UpdateProp,
  UpdateScene,
} from '@open-drama/contracts';
import { created, ok } from '../../http/envelope';
import { v } from '../../http/validate';
import { describeAsset } from '../agents/services/describe';
import { startDesign } from '../agents/services/design';
import { startExtraction } from '../agents/services/extraction';
import { generateFinalPrompt } from '../agents/services/final-prompt';
import { requestAssetImage } from './generate';
import { requestOutfitImage, updateEpisodeOutfit } from './outfits';
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
const PATHS = { character: 'characters', scene: 'scenes', prop: 'props' } as const;

export const assetsRoutes = new Hono()
  .get('/dramas/:id/assets', id, (c) => ok(c, getDramaAssets(c.req.valid('param').id)))
  .get('/episodes/:id/assets', id, (c) => ok(c, getEpisodeAssets(c.req.valid('param').id)))
  .post('/characters', v('json', CreateCharacter), (c) => created(c, createCharacter(c.req.valid('json'))))
  .patch('/characters/:id', id, v('json', UpdateCharacter), (c) =>
    ok(c, updateCharacter(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/characters/:id', id, (c) => ok(c, deleteCharacter(c.req.valid('param').id)))
  // What a character wears in one episode, and its picture (adr-0023).
  .patch('/characters/:id/outfit', id, v('json', UpdateEpisodeOutfit), (c) =>
    ok(c, updateEpisodeOutfit(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/characters/:id/outfit/image', id, v('json', RequestOutfitImage), async (c) =>
    ok(c, await requestOutfitImage(c.req.valid('param').id, c.req.valid('json'))),
  )
  .post('/scenes', v('json', CreateScene), (c) => created(c, createScene(c.req.valid('json'))))
  .patch('/scenes/:id', id, v('json', UpdateScene), (c) =>
    ok(c, updateScene(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/scenes/:id', id, (c) => ok(c, deleteScene(c.req.valid('param').id)))
  .post('/props', v('json', CreateProp), (c) => created(c, createProp(c.req.valid('json'))))
  .patch('/props/:id', id, v('json', UpdateProp), (c) => ok(c, updateProp(c.req.valid('param').id, c.req.valid('json'))))
  .delete('/props/:id', id, (c) => ok(c, deleteProp(c.req.valid('param').id)))
  .post('/episodes/:id/extract', id, v('json', StartExtraction), (c) => {
    const { target, ...opts } = c.req.valid('json');
    return ok(c, startExtraction(c.req.valid('param').id, target, opts));
  })
  // The asset designer on the whole project, one job per kind (adr-0024).
  .post('/dramas/:id/design', id, v('json', StartDesign), (c) => {
    const { target, ...opts } = c.req.valid('json');
    return ok(c, startDesign(c.req.valid('param').id, target, opts));
  });

// Agent- and generation-backed commands, the same for the three kinds.
for (const kind of AssetKind.options) {
  assetsRoutes
    .post(`/${PATHS[kind]}/:id/final-prompt`, id, v('json', GenerateFinalPrompt), async (c) =>
      ok(c, { finalPrompt: await generateFinalPrompt(kind, c.req.valid('param').id, c.req.valid('json')) }),
    )
    .post(`/${PATHS[kind]}/:id/image`, id, v('json', RequestAssetImage), async (c) =>
      ok(c, await requestAssetImage(kind, c.req.valid('param').id, c.req.valid('json'))),
    )
    // The asset designer on this one asset, in the request (adr-0024).
    .post(`/${PATHS[kind]}/:id/describe`, id, v('json', DescribeAsset), async (c) =>
      ok(c, await describeAsset(kind, c.req.valid('param').id, c.req.valid('json'))),
    );
}
