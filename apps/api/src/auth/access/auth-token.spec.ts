import { describe, expect, it } from 'vitest';
import { resolveBearerAuthToken } from './auth-token.js';

describe('resolveBearerAuthToken', () => {
  it('Bearer access token을 추출한다', () => {
    expect(resolveBearerAuthToken('Bearer opaque-access-token')).toBe('opaque-access-token');
  });

  it.each([undefined, '', 'Basic credentials', 'Bearer'])(
    'Bearer token이 아니면 null을 반환한다: %s',
    (authorization) => {
      expect(resolveBearerAuthToken(authorization)).toBeNull();
    },
  );
});
