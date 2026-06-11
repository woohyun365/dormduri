import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthOperationsModule } from './auth-operations.module.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MODULE_SOURCE_PATH = path.join(CURRENT_DIR, 'auth-operations.module.ts');

describe('AuthOperationsModule boundary', () => {
  it('운영 provider는 필요한 module이 명시 import하고 @Global module로 숨기지 않는다', () => {
    const source = readFileSync(MODULE_SOURCE_PATH, 'utf8');

    expect(AuthOperationsModule).toBeDefined();
    expect(source).not.toContain('@Global');
    expect(source).toContain('exports: [');
    expect(source).toContain('AuthOperationalCleanupService');
    expect(source).toContain('AuthOperationsHealthService');
  });
});
