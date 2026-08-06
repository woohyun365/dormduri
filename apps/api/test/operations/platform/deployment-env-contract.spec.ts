import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { requiredProductionEnvKeys } from '../../../src/config/env-keys/index.js';

const envExamplePath = resolve(process.cwd(), '../../infra/deploy/.env.api.example');

describe('API deployment env artifact', () => {
  it('required production env key를 private template에 문서화한다', () => {
    const exampleKeys = new Set(
      readFileSync(envExamplePath, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split('=', 1)[0])
        .filter((key): key is string => key !== undefined && key.length > 0),
    );
    const missingKeys = requiredProductionEnvKeys
      .map((definition) => definition.key)
      .filter((key) => !exampleKeys.has(key));

    expect(missingKeys).toEqual([]);
  });
});
