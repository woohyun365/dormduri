'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clearSignupDraft,
  readSignupDraft,
  SIGNUP_DRAFT_STORAGE_KEY,
  writeSignupDraft,
} from '../model/signup-draft-storage';
import type { SignupDraftInput, SignupDraftSnapshot } from '../model/signup-draft.types';

export interface UseSignupDraftStorageParams extends SignupDraftInput {
  readonly shouldClear: boolean;
  readonly onRestore: (draft: SignupDraftSnapshot) => void;
  readonly storageKey?: string;
}

export function useSignupDraftStorage({
  currentStep,
  email,
  isEmailVerified,
  terms,
  nickname,
  gender,
  campus,
  collegeCode,
  birthYear,
  shouldClear,
  onRestore,
  storageKey = SIGNUP_DRAFT_STORAGE_KEY,
}: UseSignupDraftStorageParams) {
  const [isRestored, setIsRestored] = useState(false);
  const onRestoreRef = useRef(onRestore);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    const draft = readSignupDraft(sessionStorage, storageKey);
    if (draft) {
      onRestoreRef.current(draft);
    }
    // sessionStorage restore gate: 기존 Signup shell은 draft 적용 전 빈 화면을 유지해야 한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!isRestored) return;

    if (shouldClear) {
      clearSignupDraft(sessionStorage, storageKey);
      return;
    }

    writeSignupDraft(
      sessionStorage,
      {
        currentStep,
        email,
        isEmailVerified,
        terms,
        nickname,
        gender,
        campus,
        ...(collegeCode !== undefined ? { collegeCode } : {}),
        ...(birthYear !== undefined ? { birthYear } : {}),
      },
      storageKey,
    );
  }, [
    birthYear,
    campus,
    collegeCode,
    currentStep,
    email,
    gender,
    isEmailVerified,
    isRestored,
    nickname,
    shouldClear,
    storageKey,
    terms,
  ]);

  return { isRestored };
}
