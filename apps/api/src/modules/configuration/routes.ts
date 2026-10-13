import { Hono } from 'hono';
import {
  AddModelService,
  ApplyQuickSetup,
  CreateStylePreset,
  IdParam,
  ModelCatalogQuery,
  ModelServiceListQuery,
  StylePresetListQuery,
  TestModelService,
  UpdateAppSettings,
  UpdateModelService,
  UpdateStylePreset,
} from '@open-drama/contracts';
import { created, ok } from '../../http/envelope';
import { invalid } from '../../http/errors';
import { v } from '../../http/validate';
import { getAssistantConnection, rotateAssistantToken } from './assistant';
import { browseModelRunnerCatalog } from './catalog';
import { createStylePreset, deleteStylePreset, listStylePresets, updateStylePreset } from './presets';
import { probeService } from './probe';
import { getReadiness } from './readiness';
import {
  addModelService,
  assertKeyFollows,
  applyQuickSetup,
  deleteModelService,
  getServiceRow,
  listModelServices,
  testSavedModelService,
  updateModelService,
} from './services';
import { getAppSettings, updateAppSettings } from './settings';

export const configurationRoutes = new Hono()
  // Model services
  .get('/model-services/readiness', (c) => ok(c, getReadiness()))
  .get('/model-services/modelrunner-catalog', v('query', ModelCatalogQuery), async (c) =>
    ok(c, await browseModelRunnerCatalog(c.req.valid('query').type)),
  )
  .get('/model-services', v('query', ModelServiceListQuery), (c) => ok(c, listModelServices(c.req.valid('query'))))
  .post('/model-services/test', v('json', TestModelService), async (c) => {
    const body = c.req.valid('json');
    // A saved service with nothing but a model override is probed with its stored key through the shared path.
    if (body.id && !body.serviceType && !body.provider && !body.baseUrl && !body.apiKey) {
      return ok(c, await testSavedModelService(body.id, body.model));
    }
    const saved = body.id ? getServiceRow(body.id) : undefined;
    if (saved) assertKeyFollows(saved, body);
    const serviceType = body.serviceType ?? saved?.serviceType;
    const provider = body.provider ?? saved?.provider;
    const baseUrl = body.baseUrl ?? saved?.baseUrl;
    const apiKey = body.apiKey || saved?.apiKey;
    if (!serviceType || !provider || !baseUrl) throw invalid('serviceType, provider and baseUrl are required');
    if (!apiKey) throw invalid('An API key is required to test the service');
    const model = body.model || saved?.models[0];
    return ok(c, await probeService({ serviceType, provider, baseUrl, apiKey, model }));
  })
  .post('/model-services/quick-setup', v('json', ApplyQuickSetup), (c) =>
    ok(c, { services: applyQuickSetup(c.req.valid('json')) }),
  )
  .post('/model-services', v('json', AddModelService), (c) => created(c, addModelService(c.req.valid('json'))))
  .patch('/model-services/:id', v('param', IdParam), v('json', UpdateModelService), (c) =>
    ok(c, updateModelService(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/model-services/:id', v('param', IdParam), (c) => ok(c, deleteModelService(c.req.valid('param').id)))
  // Style presets
  .get('/style-presets', v('query', StylePresetListQuery), (c) => ok(c, listStylePresets(c.req.valid('query').all)))
  .post('/style-presets', v('json', CreateStylePreset), (c) => created(c, createStylePreset(c.req.valid('json'))))
  .patch('/style-presets/:id', v('param', IdParam), v('json', UpdateStylePreset), (c) =>
    ok(c, updateStylePreset(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/style-presets/:id', v('param', IdParam), (c) => ok(c, deleteStylePreset(c.req.valid('param').id)))
  // App settings
  .get('/settings', (c) => ok(c, getAppSettings()))
  .patch('/settings', v('json', UpdateAppSettings), (c) => ok(c, updateAppSettings(c.req.valid('json'))))
  // The assistant connection (adr-0016): the token is a secret, so the answer is never cached.
  .get('/settings/assistant', (c) => {
    c.header('Cache-Control', 'no-store, private');
    return ok(c, getAssistantConnection());
  })
  .post('/settings/assistant/rotate', (c) => {
    c.header('Cache-Control', 'no-store, private');
    return ok(c, rotateAssistantToken());
  });
