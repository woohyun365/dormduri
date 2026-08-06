import { describe, expect, it } from 'vitest';
import {
  authRoot,
  externalAuthSourceRoots,
  importSpecifiers,
  offendingFiles,
  productionTypeScriptFiles,
  readSource,
  relativeSourcePath,
} from './auth-boundary.support.js';

describe('Auth public import boundary', () => {
  it('외부 domain이 auth internal implementation을 직접 import하지 않는다', () => {
    const forbidden =
      /from\s+['"].*(?:\.\.\/)+auth\/(?:commands|repositories|domain|policies|adapters|sessions|verification|credentials|registration|login-attempts|security-events)(?:\/[^'"]*)?(?:\.js)?['"]/;

    expect(externalAuthSourceRoots().flatMap((root) => offendingFiles(root, forbidden))).toEqual(
      [],
    );
  });

  it('외부 domain은 public auth capability 또는 explicit operations boundary만 사용한다', () => {
    const allowed = [
      /(?:^|\/)auth\/auth\.module(?:\.js)?$/,
      /(?:^|\/)auth\/access\/[^'"]+(?:\.js)?$/,
      /(?:^|\/)auth\/application\/auth-actor-context[^']*(?:\.js)?$/,
      /(?:^|\/)auth\/application\/auth-password-verifier\.service(?:\.js)?$/,
      /(?:^|\/)auth\/operations\/cleanup\/auth-operational-cleanup\.service(?:\.js)?$/,
      /(?:^|\/)auth\/operations\/health\/auth-operations-health\.service(?:\.js)?$/,
      /(?:^|\/)auth\/operations\/auth-operations\.module(?:\.js)?$/,
    ];
    const unapproved = externalAuthSourceRoots().flatMap((root) =>
      productionTypeScriptFiles(root).flatMap((path) =>
        importSpecifiers(readSource(path))
          .filter((specifier) => /(?:^|\/)auth\//.test(specifier))
          .filter((specifier) => !allowed.some((pattern) => pattern.test(specifier)))
          .map((specifier) => `${relativeSourcePath(path)} -> ${specifier}`),
      ),
    );

    expect(unapproved.sort()).toEqual([]);
  });

  it('raw password hash owner를 우회하지 않고 public verifier capability를 사용한다', () => {
    const externalRawHashConsumers = externalAuthSourceRoots().flatMap((root) =>
      offendingFiles(root, /auth\/credentials\/password-hashing|\bhashPassword\b/),
    );
    const verifierSource = readSource(`${authRoot}/application/auth-password-verifier.service.ts`);

    expect(externalRawHashConsumers).toEqual([]);
    expect(verifierSource).toContain('verifyAccountPassword');
    expect(verifierSource).not.toContain('export { hashPassword');
  });

  it('shared auth policy는 auth owner 밖 production code에서 직접 소비하지 않는다', () => {
    const consumers = externalAuthSourceRoots().flatMap((root) =>
      productionTypeScriptFiles(root)
        .filter((path) => /from\s+['"]@repo\/shared\/auth\/policy['"]/.test(readSource(path)))
        .map(relativeSourcePath),
    );

    expect(consumers.sort()).toEqual([]);
  });
});
