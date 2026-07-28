'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { authApi } from '@/auth/api';
import { SIGNUP_VERIFIED_PROOF_TTL } from '@/auth/model';
import type { LegalConsentData } from '../components/LegalConsentStep';
import { createNetworkSignupFailure, mapSignupFailure } from '../model/signup-failure-recovery';
import { initialSignupFlowState, signupFlowReducer } from '../model/signup-flow.reducer';
import { getSignupStepProgress } from '../model/signup-flow.types';
import { createSignupRequest } from '../model/signup-request.mapper';
import type { SignupAccountData } from '../model/signup-account.types';

const EMPTY_LEGAL_CONSENT: LegalConsentData = {
  agreeAge: false,
  agreeTerms: false,
  agreePersonalDataCollectionUse: false,
};

const EMPTY_BASIC_INFO: SignupAccountData = {
  nickname: '',
  password: '',
  passwordConfirm: '',
  gender: null,
  campus: null,
  collegeCode: null,
  birthYear: null,
};

function scrollToFlowStart() {
  window.scrollTo(0, 0);
}

export function useSignupFlow() {
  const [state, dispatch] = useReducer(signupFlowReducer, initialSignupFlowState);
  const [email, setEmail] = useState('');
  const [legalConsent, setLegalConsent] = useState<LegalConsentData>(EMPTY_LEGAL_CONSENT);
  const [basicInfo, setBasicInfo] = useState<SignupAccountData>(EMPTY_BASIC_INFO);

  const goNext = useCallback(() => {
    dispatch({ type: 'GO_NEXT' });
    scrollToFlowStart();
  }, []);

  const goBack = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
    scrollToFlowStart();
  }, []);

  const clearFailure = useCallback(() => {
    if (state.failure) dispatch({ type: 'FAILURE_CLEARED' });
  }, [state.failure]);

  const changeEmail = useCallback(
    (nextEmail: string) => {
      setEmail(nextEmail);
      clearFailure();
    },
    [clearFailure],
  );

  const completeEmailVerification = useCallback(() => {
    dispatch({ type: 'EMAIL_VERIFIED', verifiedAt: new Date().toISOString() });
  }, []);

  const resetAfterEmailProofExpiry = useCallback(() => {
    setLegalConsent(EMPTY_LEGAL_CONSENT);
    setBasicInfo(EMPTY_BASIC_INFO);
    dispatch({ type: 'EMAIL_PROOF_EXPIRED' });
    scrollToFlowStart();
  }, []);

  useEffect(() => {
    if (!state.emailVerifiedAt || state.currentStepId === 'COMPLETE') return;

    const expiresAt = new Date(state.emailVerifiedAt).getTime() + SIGNUP_VERIFIED_PROOF_TTL * 1000;
    const expireIfNeeded = () => {
      if (Date.now() >= expiresAt) {
        resetAfterEmailProofExpiry();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') expireIfNeeded();
    };
    const timeoutId = window.setTimeout(expireIfNeeded, Math.max(0, expiresAt - Date.now()));

    window.addEventListener('focus', expireIfNeeded);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('focus', expireIfNeeded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resetAfterEmailProofExpiry, state.currentStepId, state.emailVerifiedAt]);

  const completeAccountCredentials = useCallback((nextBasicInfo: SignupAccountData) => {
    setBasicInfo(nextBasicInfo);
    dispatch({ type: 'GO_NEXT' });
    scrollToFlowStart();
  }, []);

  const changeBasicInfo = useCallback(
    (nextBasicInfo: SignupAccountData) => {
      setBasicInfo(nextBasicInfo);
      clearFailure();
    },
    [clearFailure],
  );

  const changeLegalConsent = useCallback(
    (nextConsent: LegalConsentData) => {
      setLegalConsent(nextConsent);
      if (
        state.requiresLegalReconfirmation &&
        (nextConsent.agreeAge ||
          nextConsent.agreeTerms ||
          nextConsent.agreePersonalDataCollectionUse)
      ) {
        dispatch({ type: 'LEGAL_RECONFIRMATION_STARTED' });
      }
    },
    [state.requiresLegalReconfirmation],
  );

  const markLegalAcceptancesStale = useCallback(() => {
    setLegalConsent(EMPTY_LEGAL_CONSENT);
    dispatch({ type: 'LEGAL_ACCEPTANCES_STALE' });
    scrollToFlowStart();
  }, []);

  const submit = useCallback(
    async (nextBasicInfo = basicInfo) => {
      if (!legalConsent.legalAcceptances) {
        markLegalAcceptancesStale();
        return;
      }

      setBasicInfo(nextBasicInfo);
      dispatch({ type: 'SUBMIT_STARTED' });

      try {
        const request = createSignupRequest({
          email,
          password: nextBasicInfo.password,
          nickname: nextBasicInfo.nickname,
          gender: nextBasicInfo.gender!,
          campus: nextBasicInfo.campus!,
          collegeCode: nextBasicInfo.collegeCode!,
          birthYear: nextBasicInfo.birthYear!,
          legalAcceptances: legalConsent.legalAcceptances,
        });
        const result = await authApi.signup(request);

        if (result.success) {
          dispatch({ type: 'SUBMIT_SUCCEEDED' });
        } else if (result.code === 'AUTH_LEGAL_ACCEPTANCE_STALE') {
          markLegalAcceptancesStale();
        } else {
          const failure = mapSignupFailure(result);
          if (failure.kind === 'verification_expired') {
            resetAfterEmailProofExpiry();
          } else {
            dispatch({ type: 'SUBMIT_FAILED', failure });
          }
        }
      } catch {
        dispatch({
          type: 'SUBMIT_FAILED',
          failure: createNetworkSignupFailure(),
        });
      }
    },
    [
      basicInfo,
      email,
      legalConsent.legalAcceptances,
      markLegalAcceptancesStale,
      resetAfterEmailProofExpiry,
    ],
  );

  const progress = getSignupStepProgress(state.currentStepId);
  const fieldErrors = useMemo(
    () => (state.failure?.kind === 'field_error' ? state.failure.fieldErrors : {}),
    [state.failure],
  );

  return useMemo(
    () => ({
      state,
      progress,
      email,
      legalConsent,
      basicInfo,
      fieldErrors,
      isSubmitting: state.submitStatus === 'submitting',
      actions: {
        goNext,
        goBack,
        changeEmail,
        completeEmailVerification,
        changeLegalConsent,
        changeBasicInfo,
        completeAccountCredentials,
        clearFailure,
        submit,
      },
    }),
    [
      basicInfo,
      changeBasicInfo,
      changeEmail,
      changeLegalConsent,
      clearFailure,
      completeAccountCredentials,
      completeEmailVerification,
      email,
      fieldErrors,
      goBack,
      goNext,
      legalConsent,
      progress,
      state,
      submit,
    ],
  );
}
