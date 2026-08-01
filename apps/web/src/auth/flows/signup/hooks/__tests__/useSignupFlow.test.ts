import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_VERIFICATION_GRANT_TTL_SECONDS } from '@repo/shared/auth/policy';
import { useSignupFlow } from '../useSignupFlow';

describe('useSignupFlow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('학적 정보는 사용자가 직접 선택하도록 빈 값으로 시작한다', () => {
    const { result } = renderHook(() => useSignupFlow());

    expect(result.current.basicInfo).toMatchObject({
      gender: null,
      campus: null,
      collegeCode: null,
      birthYear: null,
    });
  });

  it('인증 proof 30분이 지나면 이메일만 유지하고 signup 입력을 초기화한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T00:00:00.000Z'));
    const { result } = renderHook(() => useSignupFlow());

    act(() => {
      result.current.actions.changeEmail('student@kangwon.ac.kr');
      result.current.actions.completeEmailVerification();
      result.current.actions.goNext();
      result.current.actions.changeLegalConsent({
        agreeAge: true,
        agreeTerms: true,
        agreePersonalDataCollectionUse: true,
      });
      result.current.actions.changeBasicInfo({
        nickname: '감자친구',
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        gender: 'M',
        campus: 'CHUNCHEON',
        collegeCode: 'CHUNCHEON_IT',
        birthYear: 2002,
      });
    });

    act(() => {
      vi.advanceTimersByTime(AUTH_VERIFICATION_GRANT_TTL_SECONDS * 1000);
    });

    expect(result.current.email).toBe('student@kangwon.ac.kr');
    expect(result.current.legalConsent).toMatchObject({
      agreeAge: false,
      agreeTerms: false,
      agreePersonalDataCollectionUse: false,
    });
    expect(result.current.basicInfo).toMatchObject({
      nickname: '',
      password: '',
      passwordConfirm: '',
      gender: null,
      campus: null,
      collegeCode: null,
      birthYear: null,
    });
    expect(result.current.state).toMatchObject({
      currentStepId: 'EMAIL_VERIFICATION',
      isEmailVerified: false,
      recoveryReason: 'EMAIL_PROOF_EXPIRED',
    });
  });

  it('30분 전에 탭을 닫고 다시 열어도 browser draft 없이 새로운 Step 1에서 시작한다', () => {
    const firstPage = renderHook(() => useSignupFlow());

    act(() => {
      firstPage.result.current.actions.changeEmail('student@kangwon.ac.kr');
      firstPage.result.current.actions.completeEmailVerification();
    });
    firstPage.unmount();

    const reopenedPage = renderHook(() => useSignupFlow());
    expect(reopenedPage.result.current.email).toBe('');
    expect(reopenedPage.result.current.state).toMatchObject({
      currentStepId: 'EMAIL_VERIFICATION',
      isEmailVerified: false,
      recoveryReason: null,
    });
  });

  it('background timer가 지연돼도 foreground 복귀 시 proof 만료를 다시 확인한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T00:00:00.000Z'));
    const { result } = renderHook(() => useSignupFlow());

    act(() => {
      result.current.actions.changeEmail('student@kangwon.ac.kr');
      result.current.actions.completeEmailVerification();
    });

    vi.setSystemTime(
      new Date('2026-07-27T00:00:00.000Z').getTime() + AUTH_VERIFICATION_GRANT_TTL_SECONDS * 1000,
    );
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.state.recoveryReason).toBe('EMAIL_PROOF_EXPIRED');
  });
});
