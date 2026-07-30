import { describe, expect, it } from 'vitest';
import {
  LOGIN_NETWORK_ERROR_MESSAGE,
  LOGIN_SERVER_ERROR_MESSAGE,
  mapLoginResponseToErrorState,
  mapLoginThrownErrorToErrorState,
} from '../login-result.mapper';

describe('login-result mapper', () => {
  it('success는 error state를 만들지 않는다', () => {
    expect(mapLoginResponseToErrorState({ success: true }, 'student@kangwon.ac.kr')).toBeNull();
  });

  it('locked response는 lockedEmail과 countdown seconds를 보존한다', () => {
    expect(
      mapLoginResponseToErrorState(
        {
          success: false,
          locked: true,
          remainingSeconds: 300,
          error: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
        },
        'student@kangwon.ac.kr',
      ),
    ).toEqual({
      status: 'locked',
      message: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
      lockedEmail: 'student@kangwon.ac.kr',
      remainingSeconds: 300,
    });
  });

  it('retryAfterSeconds는 throttled state로 매핑한다', () => {
    expect(
      mapLoginResponseToErrorState(
        {
          success: false,
          code: 'TOO_MANY_REQUESTS',
          error: '너무 잦은 요청이에요. 42초 후 다시 시도해주세요.',
          retryAfterSeconds: 42,
        },
        'student@kangwon.ac.kr',
      ),
    ).toMatchObject({
      status: 'throttled',
      message: '너무 잦은 요청이에요. 42초 후 다시 시도해주세요.',
      retryAfterSeconds: 42,
    });
  });

  it('BFF safe/server code는 generic server error로 매핑한다', () => {
    for (const code of ['BFF_RESPONSE_INVALID', 'AUTH_SERVICE_UNAVAILABLE']) {
      expect(
        mapLoginResponseToErrorState(
          { success: false, code, error: 'accessToken=must-not-show' },
          'student@kangwon.ac.kr',
        ),
      ).toEqual({ status: 'server-error', message: LOGIN_SERVER_ERROR_MESSAGE });
    }
  });

  it('기본 실패는 invalid state, throw는 network state로 매핑한다', () => {
    expect(
      mapLoginResponseToErrorState(
        { success: false, error: '계정 존재 여부를 노출하면 안 되는 upstream 문구' },
        'student@kangwon.ac.kr',
      ),
    ).toEqual({ status: 'invalid', message: '이메일 또는 비밀번호를 확인해 주세요.' });
    expect(mapLoginThrownErrorToErrorState()).toEqual({
      status: 'network-error',
      message: LOGIN_NETWORK_ERROR_MESSAGE,
    });
  });
});
