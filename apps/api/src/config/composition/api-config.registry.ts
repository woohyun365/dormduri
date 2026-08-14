import Joi from 'joi';
import emailConfig from '../../auth/adapters/email/email.config.js';
import { emailEnvKeys, emailEnvSchema } from '../../auth/adapters/email/email.env.js';
import authConfig from '../../auth/config/auth.config.js';
import { authEnvKeys, authEnvSchema } from '../../auth/config/auth.env.js';
import authOperationsConfig from '../../auth/operations/config/auth-operations.config.js';
import {
  authOperationsEnvKeys,
  authOperationsEnvSchema,
} from '../../auth/operations/config/auth-operations.env.js';
import { chatEnvKeys, chatEnvSchema } from '../../chat/config/chat.env.js';
import chatRealtimeConfig from '../../chat/realtime/chat-realtime.config.js';
import { realtimeEnvKeys, realtimeEnvSchema } from '../../chat/realtime/chat-realtime.env.js';
import lifecycleConfig from '../../lifecycle/config/lifecycle.config.js';
import { lifecycleEnvKeys, lifecycleEnvSchema } from '../../lifecycle/config/lifecycle.env.js';
import { databaseEnvKeys, databaseEnvSchema } from '../../platform/database/database.env.js';
import databaseConfig from '../../platform/database/database.config.js';
import { httpEnvKeys, httpEnvSchema } from '../../platform/http/http.env.js';
import httpConfig from '../../platform/http/http.config.js';
import observabilityConfig from '../../platform/observability/observability.config.js';
import {
  observabilityEnvKeys,
  observabilityEnvSchema,
} from '../../platform/observability/observability.env.js';
import appConfig from '../../platform/runtime/app.config.js';
import { appEnvKeys, appEnvSchema } from '../../platform/runtime/app.env.js';
import secretSourceConfig from '../../platform/runtime/secret-source.config.js';
import {
  secretSourceEnvKeys,
  secretSourceEnvSchema,
} from '../../platform/runtime/secret-source.env.js';
import { profileEnvKeys, profileEnvSchema } from '../../profiles/config/profile.env.js';
import { retentionEnvKeys, retentionEnvSchema } from '../../retention/config/retention.env.js';
import {
  roommateSearchEnvKeys,
  roommateSearchEnvSchema,
} from '../../roommate-search/config/roommate-search.env.js';
import { defineApiConfigSlice, type ApiConfigSlice } from '../environment/config-slice.js';
import type { EnvKeyDefinition } from '../environment/env-key.definition.js';

export const API_CONFIG_SLICES = [
  defineApiConfigSlice({
    owner: 'platform/runtime',
    factory: appConfig,
    schema: appEnvSchema,
    envKeys: appEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'platform/database',
    factory: databaseConfig,
    schema: databaseEnvSchema,
    envKeys: databaseEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'platform/observability',
    factory: observabilityConfig,
    schema: observabilityEnvSchema,
    envKeys: observabilityEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'auth',
    factory: authConfig,
    schema: authEnvSchema,
    envKeys: authEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'auth/operations',
    factory: authOperationsConfig,
    schema: authOperationsEnvSchema,
    envKeys: authOperationsEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'auth/adapters/email',
    factory: emailConfig,
    schema: emailEnvSchema,
    envKeys: emailEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'platform/http',
    factory: httpConfig,
    schema: httpEnvSchema,
    envKeys: httpEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'chat/realtime',
    factory: chatRealtimeConfig,
    schema: realtimeEnvSchema,
    envKeys: realtimeEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'lifecycle',
    factory: lifecycleConfig,
    schema: lifecycleEnvSchema,
    envKeys: lifecycleEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'retention',
    schema: retentionEnvSchema,
    envKeys: retentionEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'roommate-search',
    schema: roommateSearchEnvSchema,
    envKeys: roommateSearchEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'profiles',
    schema: profileEnvSchema,
    envKeys: profileEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'chat',
    schema: chatEnvSchema,
    envKeys: chatEnvKeys,
  }),
  defineApiConfigSlice({
    owner: 'platform/runtime/secrets',
    factory: secretSourceConfig,
    schema: secretSourceEnvSchema,
    envKeys: secretSourceEnvKeys,
  }),
] as const satisfies readonly ApiConfigSlice[];

export function composeApiConfigRegistry(slices: readonly ApiConfigSlice[]) {
  const factories = slices.flatMap((slice) => (slice.factory ? [slice.factory] : []));
  const schemaEntries = slices.flatMap((slice) => Object.entries(slice.schema));
  const envKeys = slices.flatMap((slice) => slice.envKeys);

  assertUnique(
    'config factory',
    factories.map((factory) => String(factory.KEY)),
  );
  assertUnique(
    'env metadata key',
    envKeys.map(({ key }) => key),
  );
  assertUnique(
    'validation schema key',
    schemaEntries.map(([key]) => key),
  );

  const schemaKeys = schemaEntries.map(([key]) => key).sort();
  const metadataKeys = envKeys.map(({ key }) => key).sort();
  if (!sameValues(schemaKeys, metadataKeys)) {
    const schemaOnly = schemaKeys.filter((key) => !metadataKeys.includes(key));
    const metadataOnly = metadataKeys.filter((key) => !schemaKeys.includes(key));
    throw new Error(
      `[config] validation schema and env metadata keys differ; schema-only=${schemaOnly.join(',') || 'none'}; metadata-only=${metadataOnly.join(',') || 'none'}`,
    );
  }

  return {
    factories,
    validationSchema: Joi.object(Object.fromEntries(schemaEntries)).unknown(true),
    envKeys,
  } as const;
}

const apiConfigRegistry = composeApiConfigRegistry(API_CONFIG_SLICES);

export const API_CONFIG_FACTORIES = apiConfigRegistry.factories;
export const API_ENV_VALIDATION_SCHEMA = apiConfigRegistry.validationSchema;
export const API_ENV_KEYS: readonly EnvKeyDefinition[] = apiConfigRegistry.envKeys;

function assertUnique(kind: string, values: readonly string[]): void {
  const duplicates = [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
  if (duplicates.length > 0) {
    throw new Error(`[config] duplicate ${kind}: ${duplicates.join(', ')}`);
  }
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
