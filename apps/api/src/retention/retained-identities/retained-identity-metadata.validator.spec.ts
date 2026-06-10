import { validateRetainedIdentityMetadata } from './retained-identity-metadata.validator.js';

describe('retained-identity-metadata.validator', () => {
  it('metadata는 schemaVersion과 허용 key만 받는다', () => {
    expect(
      validateRetainedIdentityMetadata({
        schemaVersion: 1,
        request: { requestedBy: 'USER', note: '탈퇴 요청' },
      }),
    ).toMatchObject({
      schemaVersion: 1,
      request: { requestedBy: 'USER', note: '탈퇴 요청' },
    });

    expect(() =>
      validateRetainedIdentityMetadata({
        schemaVersion: 1,
        email: 'blocked@example.com',
      }),
    ).toThrow('unsupported metadata key');
    expect(() =>
      validateRetainedIdentityMetadata({
        schemaVersion: 99,
      }),
    ).toThrow('schemaVersion=1');
    expect(() =>
      validateRetainedIdentityMetadata({
        schemaVersion: 1,
        archive: {},
      }),
    ).toThrow('unsupported metadata key');
  });
});
