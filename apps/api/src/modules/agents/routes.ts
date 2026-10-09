import { Hono } from 'hono';
import { z } from 'zod';
import {
  AgentType,
  CreateSkill,
  LangQuery,
  RunAgentRequest,
  SaveAgentPrompt,
  UpdateSkill,
} from '@open-drama/contracts';
import { created, ok } from '../../http/envelope';
import { invalid } from '../../http/errors';
import { v } from '../../http/validate';
import { getDramaRow } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { AGENTS, skillBelongsTo } from './agents/definitions';
import { runAgent } from './runtime/run-agent';
import { readAgentPrompt, resetAgentPrompt, saveAgentPrompt } from './workspace/prompts';
import { allSkillIds, createSkill, deleteSkill, listSkills, readSkill, updateSkill } from './workspace/skills';

const TypeParam = z.object({ type: AgentType });

/** Skill ids contain slashes, so they are taken from the rest of the path after /skills/. */
const skillIdOf = (path: string) => decodeURIComponent(path.replace(/^.*?\/skills\//, ''));

export const agentsRoutes = new Hono()
  .get('/agents', v('query', LangQuery), (c) => {
    const { lang } = c.req.valid('query');
    const ids = allSkillIds();
    return ok(
      c,
      AgentType.options.map((type) => {
        const prompt = readAgentPrompt(type, lang);
        return {
          type,
          name: prompt.name,
          skillCount: ids.filter((id) => skillBelongsTo(AGENTS[type], id)).length,
          model: prompt.model,
          promptSource: prompt.source,
        };
      }),
    );
  })
  .get('/agents/:type/prompt', v('param', TypeParam), v('query', LangQuery), (c) =>
    ok(c, readAgentPrompt(c.req.valid('param').type, c.req.valid('query').lang)),
  )
  .put('/agents/:type/prompt', v('param', TypeParam), v('query', LangQuery), v('json', SaveAgentPrompt), (c) => {
    const body = c.req.valid('json');
    return ok(c, saveAgentPrompt(c.req.valid('param').type, c.req.valid('query').lang, body.body, body.model));
  })
  .delete('/agents/:type/prompt', v('param', TypeParam), v('query', LangQuery), (c) =>
    ok(c, resetAgentPrompt(c.req.valid('param').type, c.req.valid('query').lang)),
  )
  .post('/agents/:type/chat', v('param', TypeParam), v('json', RunAgentRequest), async (c) => {
    const body = c.req.valid('json');
    const { type } = c.req.valid('param');
    if (AGENTS[type].jobOnly) throw invalid(`The ${AGENTS[type].name} runs only inside its job; start one from the project or the episode`);
    // A drama-scoped agent runs on the project alone; an episode-scoped one needs an episode of that project.
    let episodeId: number | undefined;
    if (AGENTS[type].scope === 'drama') {
      getDramaRow(body.dramaId);
    } else {
      if (body.episodeId === undefined) throw invalid(`The ${AGENTS[type].name} runs on an episode; pass episodeId`);
      const ep = getEpisodeRow(body.episodeId);
      if (ep.dramaId !== body.dramaId) throw invalid('The episode belongs to another project');
      episodeId = ep.id;
    }
    const { toolCalls, ...result } = await runAgent({ agentType: type, ...body, episodeId });
    return ok(c, { ...result, toolCalls });
  })
  .get('/skills', v('query', LangQuery), (c) => ok(c, listSkills(c.req.valid('query').lang)))
  .post('/skills', v('json', CreateSkill), (c) => created(c, createSkill(c.req.valid('json'))))
  .get('/skills/*', v('query', LangQuery), (c) => ok(c, readSkill(skillIdOf(c.req.path), c.req.valid('query').lang)))
  .put('/skills/*', v('query', LangQuery), v('json', UpdateSkill), (c) =>
    ok(c, updateSkill(skillIdOf(c.req.path), c.req.valid('query').lang, c.req.valid('json'))),
  )
  .delete('/skills/*', v('query', LangQuery), (c) =>
    ok(c, deleteSkill(skillIdOf(c.req.path), c.req.valid('query').lang)),
  );
