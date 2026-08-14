import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  WEB_BUILD_PUBLIC_ENV_KEYS,
  WEB_BUILD_SERVER_ENV_KEYS,
  WEB_BUILD_SECRET_ENV_KEYS,
  WEB_RUNTIME_SERVER_ENV_KEYS,
} from './env.schema';

const repoRoot = resolve(process.cwd(), '../..');
const dockerfile = readFileSync(resolve(repoRoot, 'infra/deploy/web/Dockerfile'), 'utf8');
const rehearsalCompose = readFileSync(resolve(repoRoot, 'infra/rehearsal/compose.web.yml'), 'utf8');

describe('Web deployment env projection', () => {
  it('projects production browser inputs through explicit build args', () => {
    for (const key of [
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_SENTRY_ENABLED',
      'NEXT_PUBLIC_SENTRY_DSN',
      'NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT',
      'NEXT_PUBLIC_WEB_RELEASE',
    ]) {
      expect(WEB_BUILD_PUBLIC_ENV_KEYS).toContain(key);
      expect(dockerfile).toContain(`ARG ${key}`);
      expect(dockerfile).toContain(`ENV ${key}=\${${key}}`);
    }
  });

  it('keeps server runtime env out of the browser-public projection', () => {
    for (const key of WEB_RUNTIME_SERVER_ENV_KEYS) {
      expect(WEB_BUILD_PUBLIC_ENV_KEYS).not.toContain(key);
      expect(rehearsalCompose).toContain(`${key}:`);
      expect(dockerfile).not.toMatch(new RegExp(`^(?:ARG|ENV) ${key}(?:=|$)`, 'mu'));
    }
  });

  it('projects non-secret build server inputs without mixing them into runtime env', () => {
    for (const key of WEB_BUILD_SERVER_ENV_KEYS) {
      expect(dockerfile).toContain(`ARG ${key}`);
      expect(dockerfile).toContain(`ENV ${key}=\${${key}}`);
      expect(rehearsalCompose).not.toContain(`      ${key}:`);
    }
  });

  it('injects the Sentry auth token only through an ephemeral BuildKit secret', () => {
    expect(WEB_BUILD_SECRET_ENV_KEYS).toEqual(['SENTRY_AUTH_TOKEN']);
    expect(dockerfile).toContain('type=secret,id=sentry_auth_token');
    expect(dockerfile).not.toMatch(/^(?:ARG|ENV) SENTRY_AUTH_TOKEN/mu);
  });
});
