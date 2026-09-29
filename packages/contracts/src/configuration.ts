import { z } from 'zod';
import { ContentLanguage, ProviderName, ServiceType, Timestamp } from './common';

// Model services

export const ServiceSettings = z.object({
  temperature: z.number().min(0).max(2).nullable().optional(),
});
export type ServiceSettings = z.infer<typeof ServiceSettings>;

/** A model service as returned by the API. The key itself is never returned (write-only). */
export const ModelService = z.object({
  id: z.number().int(),
  serviceType: ServiceType,
  provider: ProviderName,
  name: z.string(),
  baseUrl: z.string(),
  hasKey: z.boolean(),
  models: z.array(z.string()),
  priority: z.number().int(),
  isActive: z.boolean(),
  settings: ServiceSettings,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type ModelService = z.infer<typeof ModelService>;

const modelList = z.array(z.string().trim().min(1)).max(50);
const baseUrl = z.url({ protocol: /^https?$/ });

export const AddModelService = z.object({
  serviceType: ServiceType,
  provider: ProviderName,
  name: z.string().trim().min(1).max(100),
  baseUrl,
  apiKey: z.string().trim().max(2000).optional(),
  models: modelList.default([]),
  priority: z.number().int().min(-1000).max(1000).default(0),
  isActive: z.boolean().default(true),
  settings: ServiceSettings.default({}),
});
export type AddModelService = z.input<typeof AddModelService>;

/** Every field optional. An empty or missing apiKey keeps the stored key. */
export const UpdateModelService = z.object({
  provider: ProviderName.optional(),
  name: z.string().trim().min(1).max(100).optional(),
  baseUrl: baseUrl.optional(),
  apiKey: z.string().trim().max(2000).optional(),
  models: modelList.optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
  isActive: z.boolean().optional(),
  settings: ServiceSettings.optional(),
});
export type UpdateModelService = z.input<typeof UpdateModelService>;

export const ModelServiceListQuery = z.object({
  type: ServiceType.optional(),
  activeOnly: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

/**
 * Probe a service. Either an unsaved configuration (apiKey required), or a saved one by `id`
 * with optional overrides (a filled `apiKey` replaces the stored key for the probe only).
 */
export const TestModelService = z.object({
  id: z.number().int().positive().optional(),
  serviceType: ServiceType.optional(),
  provider: ProviderName.optional(),
  baseUrl: baseUrl.optional(),
  apiKey: z.string().trim().max(2000).optional(),
  model: z.string().trim().optional(),
});
export type TestModelService = z.input<typeof TestModelService>;

export const ModelServiceProbe = z.object({
  /** The endpoint answered. */
  reachable: z.boolean(),
  /** false when the provider rejected the key; null when the answer does not tell. */
  keyAccepted: z.boolean().nullable(),
  /** false when the provider said the default model is unknown or not activated; null when it was not checked. */
  modelAvailable: z.boolean().nullable(),
  status: z.number().int().nullable(),
  latencyMs: z.number().int(),
  message: z.string(),
});
export type ModelServiceProbe = z.infer<typeof ModelServiceProbe>;

export const ModelCatalogQuery = z.object({ type: ServiceType });

/** A catalog price in US dollars: per million tokens (text), per image, or per output second (a range over tiers). */
export const CatalogPrice = z.discriminatedUnion('unit', [
  z.object({ unit: z.literal('tokens'), input: z.number(), output: z.number() }),
  z.object({ unit: z.literal('image'), amount: z.number() }),
  z.object({ unit: z.literal('second'), min: z.number(), max: z.number() }),
]);
export type CatalogPrice = z.infer<typeof CatalogPrice>;

/** One ModelRunner endpoint the service's adapter can drive, read from the live catalog on demand (adr-0013). */
export const CatalogModel = z.object({
  /** The `owner/alias` id a service lists as a model. */
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: CatalogPrice.nullable(),
});
export type CatalogModel = z.infer<typeof CatalogModel>;

export const ConfigurationReadiness = z.object({
  missingTypes: z.array(ServiceType),
  ready: z.boolean(),
});
export type ConfigurationReadiness = z.infer<typeof ConfigurationReadiness>;

export const ApplyQuickSetup = z.object({
  gateway: z.string().min(1),
  apiKey: z.string().trim().min(1).max(2000),
});
export type ApplyQuickSetup = z.input<typeof ApplyQuickSetup>;

export const QuickSetupResult = z.object({
  services: z.array(ModelService),
});

// Style presets

export const StylePresetValue = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, digits and dashes');

export const StylePreset = z.object({
  id: z.number().int(),
  name: z.string(),
  value: z.string(),
  prompt: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  isBuiltIn: z.boolean(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type StylePreset = z.infer<typeof StylePreset>;

export const CreateStylePreset = z.object({
  name: z.string().trim().min(1).max(60),
  value: StylePresetValue,
  prompt: z.string().trim().min(1).max(2000),
  description: z.string().trim().max(300).default(''),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().default(true),
});
export type CreateStylePreset = z.input<typeof CreateStylePreset>;

/** `value` is immutable after creation. */
export const UpdateStylePreset = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  prompt: z.string().trim().min(1).max(2000).optional(),
  description: z.string().trim().max(300).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStylePreset = z.input<typeof UpdateStylePreset>;

export const StylePresetListQuery = z.object({
  all: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

// App settings

export const AppSettingsView = z.object({
  contentLanguage: ContentLanguage,
  toursSeen: z.array(z.string()),
});
export type AppSettingsView = z.infer<typeof AppSettingsView>;

/** `SetContentLanguage` and `RecordToursSeen`; toursSeen entries are added, never removed. */
export const UpdateAppSettings = z.object({
  contentLanguage: ContentLanguage.optional(),
  toursSeen: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
});
export type UpdateAppSettings = z.input<typeof UpdateAppSettings>;
