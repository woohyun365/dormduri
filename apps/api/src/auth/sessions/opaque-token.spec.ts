import {
  createOpaqueToken,
  hashOpaqueToken,
  parseOpaqueToken,
  safeCompareTokenHash,
} from './opaque-token.js';

describe('opaque token domain helper', () => {
  it('creates parseable v1 opaque tokens and stores only hashes', () => {
    const token = createOpaqueToken('session-1');

    expect(token).toMatch(/^v1\.session-1\.[A-Za-z0-9_-]{43}$/);
    expect(parseOpaqueToken(token)).toEqual({
      sessionId: 'session-1',
      tokenHash: hashOpaqueToken(token),
    });
  });

  it('rejects malformed or legacy/JWT-like token shapes', () => {
    expect(parseOpaqueToken(null)).toBeNull();
    expect(parseOpaqueToken('jwt.payload.signature')).toBeNull();
    expect(parseOpaqueToken('v1.session-1.short')).toBeNull();
    expect(parseOpaqueToken(`v1.session-1.${'a'.repeat(43)}.extra`)).toBeNull();
  });

  it('compares token hashes without accepting different-length hashes', () => {
    const token = createOpaqueToken('session-1');
    const tokenHash = hashOpaqueToken(token);

    expect(safeCompareTokenHash(tokenHash, tokenHash)).toBe(true);
    expect(safeCompareTokenHash(tokenHash, tokenHash.slice(2))).toBe(false);
    expect(safeCompareTokenHash(tokenHash, hashOpaqueToken(createOpaqueToken('session-1')))).toBe(
      false,
    );
  });
});
