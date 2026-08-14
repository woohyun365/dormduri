import { defineApiVitestConfig } from './vitest.config.base.js';

export default defineApiVitestConfig({
  test: {
    include: [
      'src/config/**/*.spec.ts',
      'src/platform/runtime/**/*.spec.ts',
      'src/health/**/*.spec.ts',
      'test/architecture/platform/config-slice-boundary.spec.ts',
      'test/architecture/platform/health-module-boundary.spec.ts',
      'test/operations/platform/deployment-env-contract.spec.ts',
      'test/operations/platform/deployment-infra.spec.ts',
      'test/operations/platform/lightsail-secret-delivery.spec.ts',
      'test/operations/platform/mounted-file-secret-reader.spec.ts',
      'test/operations/platform/runtime-bootstrap-contract.spec.ts',
    ],
    exclude: ['dist/**'],
    pool: 'forks',
    setupFiles: ['./test/setup/vitest.setup.ts'],
  },
});
