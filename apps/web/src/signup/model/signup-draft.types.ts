import type { Campus, Gender } from '@repo/shared/auth';
import type { SignupLegalAcceptances } from '@repo/shared/legal';
import type { SignupStepId } from './signup-flow.types';

export type SignupLegalBundleSource = 'api' | 'fallback';

export interface SignupDraftTerms {
  readonly agreeAge: boolean;
  readonly agreeTerms: boolean;
  readonly agreePersonalDataCollectionUse: boolean;
  readonly legalAcceptances?: SignupLegalAcceptances;
  readonly legalBundleSource?: SignupLegalBundleSource;
}

export interface SignupDraftSnapshot {
  readonly schemaVersion: 1;
  readonly currentStepId: SignupStepId;
  readonly legacyCurrentStep: number;
  readonly email: string;
  readonly isEmailVerified: boolean;
  readonly terms: SignupDraftTerms;
  readonly nickname: string;
  readonly gender: Gender | null;
  readonly campus: Campus | null;
  readonly collegeCode?: string | null;
  readonly birthYear?: number | null;
}

export interface SignupDraftInput {
  readonly currentStep: number;
  readonly email: string;
  readonly isEmailVerified: boolean;
  readonly terms: SignupDraftTerms;
  readonly nickname: string;
  readonly gender: Gender | null;
  readonly campus: Campus | null;
  readonly collegeCode?: string | null;
  readonly birthYear?: number | null;
}

export type SignupDraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
