import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ProviderName, ServiceSettings, ServiceType } from '@open-drama/contracts';
import { bool, createdAt, id, json, updatedAt } from './columns';

export const modelServices = sqliteTable('model_services', {
  id: id(),
  serviceType: text().$type<ServiceType>().notNull(),
  provider: text().$type<ProviderName>().notNull(),
  name: text().notNull(),
  baseUrl: text().notNull(),
  // Write-only: never returned by any endpoint.
  apiKey: text().notNull().default(''),
  models: json<string[]>().notNull().default([]),
  priority: integer().notNull().default(0),
  isActive: bool().notNull().default(true),
  settings: json<ServiceSettings>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const stylePresets = sqliteTable('style_presets', {
  id: id(),
  name: text().notNull(),
  value: text().notNull().unique(),
  prompt: text().notNull(),
  description: text().notNull().default(''),
  sortOrder: integer().notNull().default(0),
  isActive: bool().notNull().default(true),
  // The seed text last written for a built-in preset; null for user presets.
  // A built-in is "unedited" while prompt === seedPrompt, and only then upgraded by later seeds.
  seedPrompt: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const appSettings = sqliteTable('app_settings', {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: updatedAt(),
});
