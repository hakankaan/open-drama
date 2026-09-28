'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  AgentPrompt,
  AgentSummary,
  Skill,
  SkillSummary,
  type AgentType,
  type ContentLanguage,
  type CreateSkill,
  type UpdateSkill,
} from '@open-drama/contracts';
import { qs, request } from '@/lib/api';

export const agentKeys = {
  all: ['agents'] as const,
  catalog: (lang: ContentLanguage) => ['agents', 'catalog', lang] as const,
  prompt: (type: AgentType, lang: ContentLanguage) => ['agents', 'prompt', type, lang] as const,
  skills: (lang: ContentLanguage) => ['agents', 'skills', lang] as const,
  skill: (id: string, lang: ContentLanguage) => ['agents', 'skill', id, lang] as const,
};

export const useAgentCatalog = (lang: ContentLanguage) =>
  useQuery({ queryKey: agentKeys.catalog(lang), queryFn: () => request(z.array(AgentSummary), 'GET', '/agents' + qs({ lang })) });

export const useAgentPrompt = (type: AgentType, lang: ContentLanguage) =>
  useQuery({
    queryKey: agentKeys.prompt(type, lang),
    queryFn: () => request(AgentPrompt, 'GET', `/agents/${type}/prompt` + qs({ lang })),
  });

export const useSkills = (lang: ContentLanguage) =>
  useQuery({ queryKey: agentKeys.skills(lang), queryFn: () => request(z.array(SkillSummary), 'GET', '/skills' + qs({ lang })) });

export const useSkill = (id: string, lang: ContentLanguage, enabled: boolean) =>
  useQuery({
    queryKey: agentKeys.skill(id, lang),
    queryFn: () => request(Skill, 'GET', `/skills/${id}` + qs({ lang })),
    enabled,
  });

function useAgentsMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => void qc.invalidateQueries({ queryKey: agentKeys.all }) });
}

export const useSaveAgentPrompt = () =>
  useAgentsMutation(({ type, lang, body }: { type: AgentType; lang: ContentLanguage; body: string }) =>
    request(AgentPrompt, 'PUT', `/agents/${type}/prompt` + qs({ lang }), { body }),
  );

export const useResetAgentPrompt = () =>
  useAgentsMutation(({ type, lang }: { type: AgentType; lang: ContentLanguage }) =>
    request(AgentPrompt, 'DELETE', `/agents/${type}/prompt` + qs({ lang })),
  );

export const useCreateSkill = () => useAgentsMutation((body: CreateSkill) => request(Skill, 'POST', '/skills', body));

export const useUpdateSkill = () =>
  useAgentsMutation(({ id, lang, ...body }: UpdateSkill & { id: string; lang: ContentLanguage }) =>
    request(Skill, 'PUT', `/skills/${id}` + qs({ lang }), body),
  );

export const useDeleteSkill = () =>
  useAgentsMutation(({ id, lang }: { id: string; lang: ContentLanguage }) =>
    request(z.object({ id: z.string() }), 'DELETE', `/skills/${id}` + qs({ lang })),
  );
