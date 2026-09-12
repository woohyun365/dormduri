import { registerAs } from '@nestjs/config';
import Joi from 'joi';
import { describe, expect, it } from 'vitest';
import { defineApiConfigSlice, type NamedConfigFactory } from '../environment/config-slice.js';
import { defineEnvKeys } from '../environment/env-key.definition.js';
import {
  API_CONFIG_FACTORIES,
  API_CONFIG_SLICES,
  API_ENV_KEYS,
  API_ENV_VALIDATION_SCHEMA,
  composeApiConfigRegistry,
} from './api-config.registry.js';

describe('API config registry', () => {
  it('derives factories, validation, and env metadata from one slice list', () => {
    const schemaDescription = API_ENV_VALIDATION_SCHEMA.describe() as {
      keys?: Record<string, unknown>;
    };

    expect(API_CONFIG_SLICES).toHaveLength(14);
    expect(API_CONFIG_FACTORIES).toHaveLength(10);
    expect(API_ENV_KEYS).toHaveLength(102);
    expect(Object.keys(schemaDescription.keys ?? {})).toHaveLength(102);
  });

  it('rejects duplicate env metadata keys', () => {
    const key = defineEnvKeys([envKey('DUPLICATE_KEY')]);

    expect(() => composeApiConfigRegistry([slice('first', key), slice('second', key)])).toThrow(
      'duplicate env metadata key: DUPLICATE_KEY',
    );
  });

  it('rejects schema-only keys', () => {
    expect(() =>
      composeApiConfigRegistry([
        defineApiConfigSlice({
          owner: 'schema-only',
          schema: { SCHEMA_ONLY: Joi.string() },
          envKeys: [],
        }),
      ]),
    ).toThrow('schema-only=SCHEMA_ONLY; metadata-only=none');
  });

  it('rejects metadata-only keys', () => {
    expect(() =>
      composeApiConfigRegistry([
        defineApiConfigSlice({
          owner: 'metadata-only',
          schema: {},
          envKeys: defineEnvKeys([envKey('METADATA_ONLY')]),
        }),
      ]),
    ).toThrow('schema-only=none; metadata-only=METADATA_ONLY');
  });

  it('rejects duplicate config factory keys', () => {
    expect(() =>
      composeApiConfigRegistry([
        factorySlice(
          'first',
          registerAs('duplicate', () => ({ first: true })),
        ),
        factorySlice(
          'second',
          registerAs('duplicate', () => ({ second: true })),
        ),
      ]),
    ).toThrow('duplicate config factory: CONFIGURATION(duplicate)');
  });

  it('keeps env metadata ordering deterministic', () => {
    const registry = composeApiConfigRegistry([
      slice('first', defineEnvKeys([envKey('FIRST')]), { FIRST: Joi.string() }),
      slice('second', defineEnvKeys([envKey('SECOND')]), { SECOND: Joi.string() }),
    ]);

    expect(registry.envKeys.map(({ key }) => key)).toEqual(['FIRST', 'SECOND']);
  });
});

function slice(
  owner: string,
  envKeys: ReturnType<typeof defineEnvKeys>,
  schema: Record<string, Joi.Schema> = Object.fromEntries(
    envKeys.map(({ key }) => [key, Joi.string()]),
  ),
) {
  return defineApiConfigSlice({ owner, schema, envKeys });
}

function factorySlice(owner: string, factory: NamedConfigFactory) {
  return defineApiConfigSlice({ owner, factory, schema: {}, envKeys: [] });
}

function envKey(key: string) {
  return {
    key,
    owner: 'platform-runtime',
    category: 'runtime',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: `${key} test key`,
  } as const;
}
