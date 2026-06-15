import { describe, expect, it } from 'vitest';

import {
  getStressRedactedPlaceholder,
  redactStressFixtureSecrets,
} from './stress-secret-redaction.js';

describe('stress secret redaction', () => {
  it('removes fixture emails, tokens, passwords, sessions, cookies, and auth headers from summaries', () => {
    const redacted = redactStressFixtureSecrets({
      actorId: 'stress-local-actor-0001',
      email: 'stress-local+0001@stress.example.invalid',
      password: 'raw-password',
      accessToken: 'raw-access-token',
      headers: {
        authorization: 'Bearer raw-bearer-token',
        cookie: 'stress_session=raw-session-cookie',
      },
      nested: [{ note: 'contact stress-local+0002@stress.example.invalid' }],
    });

    const serialized = JSON.stringify(redacted);
    const placeholder = getStressRedactedPlaceholder();

    expect(serialized).toContain('stress-local-actor-0001');
    expect(serialized).toContain(placeholder);
    expect(serialized).not.toContain('stress-local+0001');
    expect(serialized).not.toContain('raw-password');
    expect(serialized).not.toContain('raw-access-token');
    expect(serialized).not.toContain('raw-bearer-token');
    expect(serialized).not.toContain('raw-session-cookie');
    expect(serialized).not.toContain('stress-local+0002');
  });
});
