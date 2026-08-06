import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const apiRoot = process.cwd();
const apiContractRoot = join(apiRoot, 'test/architecture/api-contracts');

describe('api contract spec boundary', () => {
  it('keeps broad shared-reference spec limited to excluded profile/matching owners', () => {
    const sharedReferencePath = join(apiContractRoot, 'shared-reference-contracts.spec.ts');
    const source = readFileSync(sharedReferencePath, 'utf8');

    for (const forbiddenSpecifier of [
      '@repo/shared/user',
      '@repo/shared/user/identity/display',
      '@repo/shared/user/identity/academic',
      '@repo/shared/user/identity/account',
      '@repo/shared/lifestyle',
      '@repo/shared/date',
      '@repo/shared/campus',
      '@repo/shared/identity/primitives',
    ]) {
      expect(source).not.toContain(forbiddenSpecifier);
    }

    for (const allowedSpecifier of [
      '@repo/shared/profile/contract',
      '@repo/shared/roommate-search/contract',
      '@repo/shared/match/contract',
    ]) {
      expect(source).toContain(allowedSpecifier);
    }
  });
});
