import { describe, expect, it } from 'vitest';
import { toAuthSessionUserSummary } from './auth-user-view.js';

describe('auth user view boundary', () => {
  it('session summary는 최소 identity 필드만 반환한다', () => {
    expect(
      toAuthSessionUserSummary({
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
      }),
    ).toEqual({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
    });
  });
});
