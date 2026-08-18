'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseDisplayIdentityNickname } from '@repo/shared/user/identity';
import type { SignupNicknameValidationRequest } from '@repo/shared/auth/contract';
import type { SignupNicknameValidationResponse } from '@repo/shared/auth/response';
import {
  INITIAL_SIGNUP_NICKNAME_VALIDATION_STATE,
  type SignupNicknameValidationState,
} from '../model/signup-nickname-validation.types';
import { SIGNUP_FEEDBACK_COPY } from '../model/signup-feedback.copy';

export type ValidateSignupNicknameAction = (
  data: SignupNicknameValidationRequest,
  signal?: AbortSignal,
) => Promise<SignupNicknameValidationResponse>;

interface UseSignupNicknameValidationInput {
  nickname: string;
  serverError?: string;
  validateAction: ValidateSignupNicknameAction;
  onCanonicalNickname: (nickname: string) => void;
}

function toNicknameKey(nickname: string): string | null {
  const parsed = parseDisplayIdentityNickname(nickname);
  return parsed.ok ? parsed.normalized : null;
}

export function useSignupNicknameValidation({
  nickname,
  serverError,
  validateAction,
  onCanonicalNickname,
}: UseSignupNicknameValidationInput) {
  const [state, setState] = useState<SignupNicknameValidationState>(
    INITIAL_SIGNUP_NICKNAME_VALIDATION_STATE,
  );
  const requestSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentNicknameKey = useMemo(() => toNicknameKey(nickname), [nickname]);
  const currentState = serverError
    ? ({
        status: 'rejected',
        nicknameKey: currentNicknameKey,
        message: serverError,
      } satisfies SignupNicknameValidationState)
    : state;
  const isCurrentNicknameAvailable =
    currentState.status === 'available' &&
    currentNicknameKey !== null &&
    currentState.nicknameKey === currentNicknameKey;

  const cancelPendingRequest = useCallback(() => {
    requestSequenceRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  useEffect(() => cancelPendingRequest, [cancelPendingRequest]);

  useEffect(() => {
    if (!serverError) return;
    cancelPendingRequest();
  }, [cancelPendingRequest, serverError]);

  const invalidate = useCallback(
    (nextNickname: string) => {
      const nextKey = toNicknameKey(nextNickname);
      cancelPendingRequest();
      setState((previous) => {
        if (
          previous.status === 'available' &&
          nextKey !== null &&
          previous.nicknameKey === nextKey
        ) {
          return previous;
        }
        if (previous.status === 'available') {
          return {
            status: 'stale',
            message: SIGNUP_FEEDBACK_COPY.credentials.nickname.edited,
          };
        }
        return INITIAL_SIGNUP_NICKNAME_VALIDATION_STATE;
      });
    },
    [cancelPendingRequest],
  );

  const requireCurrentValidation = useCallback(() => {
    const parsed = parseDisplayIdentityNickname(nickname);
    if (!parsed.ok) {
      setState({
        status: 'rejected',
        nicknameKey: null,
        message: parsed.message,
      });
      return false;
    }
    if (currentState.status === 'available' && currentState.nicknameKey === parsed.normalized) {
      return true;
    }
    setState({
      status: 'stale',
      message: SIGNUP_FEEDBACK_COPY.credentials.nickname.required,
    });
    return false;
  }, [currentState, nickname]);

  const validate = useCallback(async () => {
    const parsed = parseDisplayIdentityNickname(nickname);
    if (!parsed.ok) {
      cancelPendingRequest();
      setState({ status: 'rejected', nicknameKey: null, message: parsed.message });
      return 'rejected' as const;
    }

    cancelPendingRequest();
    const requestSequence = requestSequenceRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setState({ status: 'checking', nicknameKey: parsed.normalized });

    try {
      const response = await validateAction({ nickname: parsed.value }, abortController.signal);
      if (requestSequence !== requestSequenceRef.current || abortController.signal.aborted) {
        return 'stale' as const;
      }

      if (response.success) {
        const validated = parseDisplayIdentityNickname(response.nickname);
        if (!validated.ok) {
          setState({
            status: 'unavailable',
            nicknameKey: parsed.normalized,
            message: SIGNUP_FEEDBACK_COPY.credentials.nickname.unavailable,
          });
          return 'unavailable' as const;
        }
        onCanonicalNickname(validated.value);
        setState({
          status: 'available',
          nicknameKey: validated.normalized,
          message: SIGNUP_FEEDBACK_COPY.credentials.nickname.available,
        });
        return 'available' as const;
      }

      if (response.code === 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED') {
        setState({
          status: 'expired',
          nicknameKey: parsed.normalized,
          message: SIGNUP_FEEDBACK_COPY.credentials.nickname.expired,
        });
        return 'expired' as const;
      }

      const fieldError = response.fieldErrors?.nickname;
      if (fieldError) {
        setState({
          status: 'rejected',
          nicknameKey: parsed.normalized,
          message: fieldError,
        });
        return 'rejected' as const;
      }

      setState({
        status: 'unavailable',
        nicknameKey: parsed.normalized,
        message: response.error || SIGNUP_FEEDBACK_COPY.credentials.nickname.unavailable,
      });
      return 'unavailable' as const;
    } catch (error) {
      if (
        requestSequence !== requestSequenceRef.current ||
        abortController.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        return 'stale' as const;
      }
      setState({
        status: 'unavailable',
        nicknameKey: parsed.normalized,
        message: SIGNUP_FEEDBACK_COPY.common.connectivity,
      });
      return 'unavailable' as const;
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [cancelPendingRequest, nickname, onCanonicalNickname, validateAction]);

  return {
    state: currentState,
    isCurrentNicknameAvailable,
    invalidate,
    requireCurrentValidation,
    validate,
  };
}
