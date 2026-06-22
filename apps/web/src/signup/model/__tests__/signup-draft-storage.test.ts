import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSignupDraft,
  createSignupDraftSnapshot,
  parseSignupDraft,
  readSignupDraft,
  SIGNUP_DRAFT_STORAGE_KEY,
  writeSignupDraft,
} from '../signup-draft-storage';
import type { SignupDraftInput, SignupDraftStorage } from '../signup-draft.types';

const legalAcceptances = {
  termsVersionId: 'terms-of-service-2026-06-22',
  personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
  ageNoticeVersionId: 'age-14-or-above-notice-2026-06-22',
  privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
};

const draftInput: SignupDraftInput = {
  currentStep: 6,
  email: 'tester@kangwon.ac.kr',
  isEmailVerified: true,
  terms: {
    agreeAge: true,
    agreeTerms: true,
    agreePersonalDataCollectionUse: true,
    legalAcceptances,
    legalBundleSource: 'api',
  },
  nickname: 'tester',
  gender: 'M',
  campus: 'CHUNCHEON',
  collegeCode: 'IT',
  birthYear: 2002,
};

function createMemoryStorage(): SignupDraftStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();

  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe('signup draft storage', () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('transition 기간에는 legacy step을 최대 3으로 clamp하고 final step id를 함께 기록한다', () => {
    expect(createSignupDraftSnapshot(draftInput)).toMatchObject({
      legacyCurrentStep: 3,
      currentStepId: 'ACCOUNT_IDENTITY',
      schemaVersion: 1,
    });
  });

  it('password/code/raw legal body/lifestyle/intro를 저장하지 않는 allowlist JSON만 쓴다', () => {
    writeSignupDraft(storage, {
      ...draftInput,
      password: 'must-not-store',
      code: '123456',
      intro: '안녕하세요',
      lifestyle: { bedtime: '23:00' },
      terms: {
        ...draftInput.terms,
        sections: [{ type: 'paragraph', text: 'raw legal body' }],
        summaryItems: ['raw summary'],
      },
    } as SignupDraftInput);

    const rawDraft = storage.values.get(SIGNUP_DRAFT_STORAGE_KEY)!;
    expect(rawDraft).toContain('legalAcceptances');
    expect(rawDraft).toContain('privacyPolicyVersionIdShown');
    expect(rawDraft).not.toContain('must-not-store');
    expect(rawDraft).not.toContain('123456');
    expect(rawDraft).not.toContain('intro');
    expect(rawDraft).not.toContain('lifestyle');
    expect(rawDraft).not.toContain('raw legal body');
    expect(rawDraft).not.toContain('summaryItems');
  });

  it('corrupt JSON은 null로 복원하고 storage를 정리한다', () => {
    storage.values.set(SIGNUP_DRAFT_STORAGE_KEY, '{broken json');

    expect(readSignupDraft(storage)).toBeNull();
    expect(storage.values.has(SIGNUP_DRAFT_STORAGE_KEY)).toBe(false);
  });

  it('email 미인증 상태에서는 protected legacy step을 1로 되돌린다', () => {
    const restored = parseSignupDraft(
      JSON.stringify({
        currentStep: 3,
        email: 'tester@kangwon.ac.kr',
        isEmailVerified: false,
        terms: { agreeAge: true, agreeTerms: true, agreePersonalDataCollectionUse: true },
      }),
    );

    expect(restored).toMatchObject({
      legacyCurrentStep: 1,
      currentStepId: 'EMAIL_VERIFICATION',
      isEmailVerified: false,
    });
  });

  it('clearSignupDraft는 storage key를 삭제한다', () => {
    writeSignupDraft(storage, draftInput);
    clearSignupDraft(storage);

    expect(storage.values.has(SIGNUP_DRAFT_STORAGE_KEY)).toBe(false);
  });
});
