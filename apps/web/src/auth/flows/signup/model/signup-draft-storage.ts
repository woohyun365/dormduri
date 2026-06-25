import type { Campus, Gender } from '@repo/shared/auth';
import { collegeCodeSchema, type CollegeCode } from '@repo/shared/college';
import type { SignupLegalAcceptances } from '@repo/shared/legal';
import type { SignupStepId } from './signup-flow.types';
import type {
  SignupDraftInput,
  SignupDraftSnapshot,
  SignupDraftStorage,
} from './signup-draft.types';

export const SIGNUP_DRAFT_STORAGE_KEY = 'signup-draft';
export const SIGNUP_DRAFT_SCHEMA_VERSION = 1;
export const MAX_RESTORABLE_LEGACY_SIGNUP_STEP = 3;

const EMPTY_TERMS = {
  agreeAge: false,
  agreeTerms: false,
  agreePersonalDataCollectionUse: false,
} as const;

const LEGACY_STEP_TO_STEP_ID: Record<number, SignupStepId> = {
  1: 'EMAIL_VERIFICATION',
  2: 'LEGAL_CONSENT',
  3: 'ACCOUNT_IDENTITY',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNullableGender(value: unknown): Gender | null {
  return value === 'M' || value === 'F' ? value : null;
}

function asNullableCampus(value: unknown): Campus | null {
  return value === 'CHUNCHEON' || value === 'SAMCHEOK' || value === 'DOGYE' ? value : null;
}

function asNullableCollegeCode(value: unknown): CollegeCode | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = collegeCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asSignupStepId(value: unknown): SignupStepId | undefined {
  return value === 'EMAIL_VERIFICATION' ||
    value === 'LEGAL_CONSENT' ||
    value === 'ACCOUNT_IDENTITY' ||
    value === 'COMPLETE'
    ? value
    : undefined;
}

function asLegalAcceptances(value: unknown): SignupLegalAcceptances | undefined {
  if (!isRecord(value)) return undefined;

  const termsVersionId = asString(value.termsVersionId);
  const personalDataConsentVersionId = asString(value.personalDataConsentVersionId);
  const ageNoticeVersionId = asString(value.ageNoticeVersionId);
  const privacyPolicyVersionIdShown = asString(value.privacyPolicyVersionIdShown);

  if (
    !termsVersionId ||
    !personalDataConsentVersionId ||
    !ageNoticeVersionId ||
    !privacyPolicyVersionIdShown
  ) {
    return undefined;
  }

  return {
    termsVersionId,
    personalDataConsentVersionId,
    ageNoticeVersionId,
    privacyPolicyVersionIdShown,
  };
}

function normalizeTerms(value: unknown): SignupDraftSnapshot['terms'] {
  if (!isRecord(value)) return EMPTY_TERMS;

  const legalAcceptances = asLegalAcceptances(value.legalAcceptances);
  const legalBundleSource =
    value.legalBundleSource === 'api' || value.legalBundleSource === 'fallback'
      ? value.legalBundleSource
      : undefined;

  return {
    agreeAge: asBoolean(value.agreeAge),
    agreeTerms: asBoolean(value.agreeTerms),
    agreePersonalDataCollectionUse: asBoolean(
      value.agreePersonalDataCollectionUse ?? value.agreePrivacy,
    ),
    ...(legalAcceptances ? { legalAcceptances } : {}),
    ...(legalBundleSource ? { legalBundleSource } : {}),
  };
}

export function normalizeLegacySignupStep(
  value: unknown,
  options: { isEmailVerified: boolean },
): number {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 1;
  const clamped = Math.min(Math.max(numberValue, 1), MAX_RESTORABLE_LEGACY_SIGNUP_STEP);
  return !options.isEmailVerified && clamped > 1 ? 1 : clamped;
}

function stepIdToLegacyStep(stepId: SignupStepId): number {
  if (stepId === 'EMAIL_VERIFICATION') return 1;
  if (stepId === 'LEGAL_CONSENT') return 2;
  return 3;
}

function resolveLegacyStep(raw: Record<string, unknown>, isEmailVerified: boolean): number {
  const explicitLegacyStep = raw.legacyCurrentStep ?? raw.currentStep;
  if (explicitLegacyStep !== undefined) {
    return normalizeLegacySignupStep(explicitLegacyStep, { isEmailVerified });
  }

  const stepId = asSignupStepId(raw.currentStepId);
  return normalizeLegacySignupStep(stepId ? stepIdToLegacyStep(stepId) : 1, { isEmailVerified });
}

export function createSignupDraftSnapshot(input: SignupDraftInput): SignupDraftSnapshot {
  const legacyCurrentStep = normalizeLegacySignupStep(input.currentStep, {
    isEmailVerified: input.isEmailVerified,
  });

  return {
    schemaVersion: SIGNUP_DRAFT_SCHEMA_VERSION,
    currentStepId: LEGACY_STEP_TO_STEP_ID[legacyCurrentStep]!,
    legacyCurrentStep,
    email: input.email,
    isEmailVerified: input.isEmailVerified,
    terms: normalizeTerms(input.terms),
    nickname: input.nickname,
    gender: input.gender,
    campus: input.campus,
    ...(input.collegeCode !== undefined ? { collegeCode: input.collegeCode } : {}),
    ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
  };
}

export function parseSignupDraft(raw: string): SignupDraftSnapshot | null {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) return null;

  const isEmailVerified = asBoolean(parsed.isEmailVerified);
  const legacyCurrentStep = resolveLegacyStep(parsed, isEmailVerified);
  const collegeCode = asNullableCollegeCode(parsed.collegeCode);
  const birthYear = asNullableNumber(parsed.birthYear);

  return {
    schemaVersion: SIGNUP_DRAFT_SCHEMA_VERSION,
    currentStepId: LEGACY_STEP_TO_STEP_ID[legacyCurrentStep]!,
    legacyCurrentStep,
    email: asString(parsed.email),
    isEmailVerified,
    terms: normalizeTerms(parsed.terms),
    nickname: asString(parsed.nickname),
    gender: asNullableGender(parsed.gender),
    campus: asNullableCampus(parsed.campus),
    ...(collegeCode !== undefined ? { collegeCode } : {}),
    ...(birthYear !== undefined ? { birthYear } : {}),
  };
}

export function readSignupDraft(
  storage: SignupDraftStorage,
  key = SIGNUP_DRAFT_STORAGE_KEY,
): SignupDraftSnapshot | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    return parseSignupDraft(raw);
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function writeSignupDraft(
  storage: SignupDraftStorage,
  input: SignupDraftInput,
  key = SIGNUP_DRAFT_STORAGE_KEY,
): void {
  try {
    storage.setItem(key, JSON.stringify(createSignupDraftSnapshot(input)));
  } catch {
    /* storage unavailable or full */
  }
}

export function clearSignupDraft(
  storage: SignupDraftStorage,
  key = SIGNUP_DRAFT_STORAGE_KEY,
): void {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
