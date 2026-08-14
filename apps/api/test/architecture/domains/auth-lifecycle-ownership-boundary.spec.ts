import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  authRoot,
  importSpecifiers,
  offendingFiles,
  productionTypeScriptFiles,
  relativeSourcePath,
  readSource,
  walkDirectories,
} from './auth-boundary.support.js';

describe('Auth lifecycle ownership boundary', () => {
  it('cross-slice auth bucket와 ambiguous verification store를 사용하지 않는다', () => {
    expect(
      offendingFiles(authRoot, /\bAuthUseCases\b|\bAuthVerificationStore\b|\bAuthFlowMetrics\b/),
    ).toEqual([]);
  });

  it('account lock과 network throttle state owner가 서로 의존하지 않는다', () => {
    const accountLockImports = productionTypeScriptFiles(
      join(authRoot, 'login-attempts/account-lock'),
    ).flatMap((path) => importSpecifiers(readSource(path)));
    const networkThrottleImports = productionTypeScriptFiles(
      join(authRoot, 'login-attempts/network-throttle'),
    ).flatMap((path) => importSpecifiers(readSource(path)));

    expect(
      accountLockImports.filter((specifier) => specifier.includes('network-throttle')),
    ).toEqual([]);
    expect(
      networkThrottleImports.filter((specifier) => specifier.includes('account-lock')),
    ).toEqual([]);
  });

  it('verification과 login admission lifecycle에 generic technical layer를 두지 않는다', () => {
    const forbiddenLayers = new Set(['commands', 'queries', 'repositories', 'services']);
    const roots = [join(authRoot, 'verification'), join(authRoot, 'login-attempts')];
    const offenders = roots
      .flatMap(walkDirectories)
      .filter((path) => forbiddenLayers.has(basename(path)))
      .map(relativeSourcePath)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('session, mail, security-event lifecycle은 cohesive owner를 유지한다', () => {
    const forbiddenLayers = new Set(['commands', 'queries', 'repositories', 'services']);
    const offenders = ['sessions', 'mail', 'security-events']
      .map((directory) => join(authRoot, directory))
      .flatMap(walkDirectories)
      .filter((path) => forbiddenLayers.has(basename(path)))
      .map(relativeSourcePath)
      .sort();

    expect(offenders).toEqual([]);
  });
});
