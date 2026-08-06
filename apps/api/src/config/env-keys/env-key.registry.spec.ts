import { describe, expect, it } from 'vitest';
import { envValidationSchema } from '../env.validation.js';
import { ALL_ENV_KEYS, productionDefaultForbiddenEnvKeys, secretEnvKeys } from './index.js';

function describeSchemaKeys(): Set<string> {
  const description = envValidationSchema.describe() as { keys?: Record<string, unknown> };
  return new Set(Object.keys(description.keys ?? {}));
}

describe('env key registry', () => {
  it('keeps env key names unique', () => {
    const keys = ALL_ENV_KEYS.map((definition) => definition.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps registry and Joi validation schema in sync', () => {
    const registryKeys = new Set(ALL_ENV_KEYS.map((definition) => definition.key));
    const schemaKeys = describeSchemaKeys();

    expect([...registryKeys].filter((key) => !schemaKeys.has(key))).toEqual([]);
    expect([...schemaKeys].filter((key) => !registryKeys.has(key))).toEqual([]);
  });

  it('marks every secret key as secret-store sourced or explicitly process-bound', () => {
    expect(secretEnvKeys.length).toBeGreaterThan(0);
    expect(
      secretEnvKeys.filter(
        (definition) => !['secret-store', 'process-env'].includes(definition.source),
      ),
    ).toEqual([]);
  });

  it('tracks production placeholder/default-forbidden keys separately', () => {
    expect(productionDefaultForbiddenEnvKeys.length).toBeGreaterThan(0);
    expect(
      productionDefaultForbiddenEnvKeys.filter(
        (definition) =>
          definition.placeholderAllowed === true || definition.requiredInProduction !== true,
      ),
    ).toEqual([]);
  });
});
