'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  AppSettingsView,
  ConfigurationReadiness,
  Health,
  ModelService,
  ModelServiceProbe,
  QuickSetupResult,
  StylePreset,
  type AddModelService,
  type ApplyQuickSetup,
  type CreateStylePreset,
  type ServiceType,
  type TestModelService,
  type UpdateAppSettings,
  type UpdateModelService,
  type UpdateStylePreset,
} from '@open-drama/contracts';
import { qs, request } from '@/lib/api';

export const configurationKeys = {
  readiness: ['configuration', 'readiness'] as const,
  health: ['system', 'health'] as const,
  services: ['configuration', 'services'] as const,
  presets: (all: boolean) => ['configuration', 'presets', all] as const,
  settings: ['configuration', 'settings'] as const,
};

export const useReadiness = () =>
  useQuery({
    queryKey: configurationKeys.readiness,
    queryFn: () => request(ConfigurationReadiness, 'GET', '/model-services/readiness'),
  });

export const useHealth = () =>
  useQuery({ queryKey: configurationKeys.health, queryFn: () => request(Health, 'GET', '/health') });

// Model services

export const useModelServices = (type?: ServiceType, activeOnly = false) =>
  useQuery({
    queryKey: [...configurationKeys.services, type ?? 'all', activeOnly],
    queryFn: () => request(z.array(ModelService), 'GET', '/model-services' + qs({ type, activeOnly: activeOnly ? 1 : undefined })),
  });

/** Every model-service change refreshes the lists and the readiness banner. */
function useServiceMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: configurationKeys.services });
      void qc.invalidateQueries({ queryKey: configurationKeys.readiness });
    },
  });
}

export const useAddModelService = () =>
  useServiceMutation((body: AddModelService) => request(ModelService, 'POST', '/model-services', body));

export const useUpdateModelService = () =>
  useServiceMutation(({ id, ...body }: UpdateModelService & { id: number }) =>
    request(ModelService, 'PATCH', `/model-services/${id}`, body),
  );

export const useDeleteModelService = () =>
  useServiceMutation((id: number) => request(z.object({ id: z.number() }), 'DELETE', `/model-services/${id}`));

export const useApplyQuickSetup = () =>
  useServiceMutation((body: ApplyQuickSetup) => request(QuickSetupResult, 'POST', '/model-services/quick-setup', body));

export const useTestModelService = () =>
  useMutation({
    mutationFn: (body: TestModelService) => request(ModelServiceProbe, 'POST', '/model-services/test', body),
  });

// Style presets

export const useStylePresets = (all = false) =>
  useQuery({
    queryKey: configurationKeys.presets(all),
    queryFn: () => request(z.array(StylePreset), 'GET', '/style-presets' + qs({ all: all ? 1 : undefined })),
  });

function usePresetMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => void qc.invalidateQueries({ queryKey: ['configuration', 'presets'] }),
  });
}

export const useCreateStylePreset = () =>
  usePresetMutation((body: CreateStylePreset) => request(StylePreset, 'POST', '/style-presets', body));

export const useUpdateStylePreset = () =>
  usePresetMutation(({ id, ...body }: UpdateStylePreset & { id: number }) =>
    request(StylePreset, 'PATCH', `/style-presets/${id}`, body),
  );

export const useDeleteStylePreset = () =>
  usePresetMutation((id: number) => request(z.object({ id: z.number() }), 'DELETE', `/style-presets/${id}`));

// App settings

export const useAppSettings = () =>
  useQuery({ queryKey: configurationKeys.settings, queryFn: () => request(AppSettingsView, 'GET', '/settings') });

export function useUpdateAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAppSettings) => request(AppSettingsView, 'PATCH', '/settings', body),
    onSuccess: (data) => qc.setQueryData(configurationKeys.settings, data),
  });
}
