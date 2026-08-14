import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyMaterializedSecretsToEnv,
  materializeRequiredSecrets,
} from '../../../src/config/secrets/secret-materializer.js';

const apiRoot = process.cwd();
const mainPath = join(apiRoot, 'src/main.ts');

describe('API runtime bootstrap contract', () => {
  it('has bounded secret materialization primitives available to bootstrap', () => {
    expect(materializeRequiredSecrets).toBeTypeOf('function');
    expect(applyMaterializedSecretsToEnv).toBeTypeOf('function');
  });

  it('materializes required secrets before creating the Nest application', () => {
    const source = readFileSync(mainPath, 'utf8');
    const materializationIndex = source.search(
      /prepareRuntimeEnvironment|materializeRequiredSecrets/gu,
    );
    const nestCreationIndex = source.indexOf('NestFactory.create');

    expect(materializationIndex).toBeGreaterThanOrEqual(0);
    expect(nestCreationIndex).toBeGreaterThan(materializationIndex);
  });

  it('loads AppModule only after runtime preparation is declared', () => {
    const source = readFileSync(mainPath, 'utf8');
    const materializationIndex = source.indexOf('await prepareRuntimeEnvironment');
    const appModuleImportIndex = source.indexOf("import('./app.module.js')");

    expect(source).not.toMatch(/from ['"]\.\/app\.module\.js['"]/u);
    expect(appModuleImportIndex).toBeGreaterThan(materializationIndex);
  });

  it('logs only bounded bootstrap failure fields', () => {
    const source = readFileSync(mainPath, 'utf8');

    expect(source).toContain('describeRuntimeEnvironmentPreparationFailure(error)');
    expect(source).not.toMatch(/console\.(?:error|log)\(error\)/u);
    expect(source).not.toContain('JSON.stringify(error)');
  });
});
