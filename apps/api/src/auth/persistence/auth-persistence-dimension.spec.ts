import { describe, expect, it } from 'vitest';
import { hashAuthPersistenceDimension } from './auth-persistence-dimension.js';

describe('hashAuthPersistenceDimension', () => {
  const secret = 'test-auth-persistence-hmac-secret';

  it('raw dimension을 노출하지 않는 versioned keyed HMAC을 반환한다', () => {
    const result = hashAuthPersistenceDimension('subject', 'student@kangwon.ac.kr', secret);

    expect(result).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(result).not.toContain('student');
    expect(result).not.toContain('@kangwon.ac.kr');
  });

  it('namespace를 분리해 같은 값의 subject와 request IP를 다른 key로 만든다', () => {
    const value = 'same-value';

    expect(hashAuthPersistenceDimension('subject', value, secret)).not.toBe(
      hashAuthPersistenceDimension('request-ip', value, secret),
    );
  });

  it('같은 namespace와 정규화된 값은 안정적인 lookup key를 만든다', () => {
    expect(hashAuthPersistenceDimension('subject', ' USER@KANGWON.AC.KR ', secret)).toBe(
      hashAuthPersistenceDimension('subject', 'user@kangwon.ac.kr', secret),
    );
  });
});
