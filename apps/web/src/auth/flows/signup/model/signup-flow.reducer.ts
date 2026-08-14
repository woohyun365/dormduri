import type { SignupFailure } from './signup-recovery.types';
import { getNextSignupStep, getPreviousSignupStep, type SignupStepId } from './signup-flow.types';

export type SignupSubmitStatus = 'idle' | 'submitting' | 'succeeded' | 'failed';

export interface SignupFlowState {
  readonly currentStepId: SignupStepId;
  readonly isEmailVerified: boolean;
  readonly emailVerifiedAt: string | null;
  readonly recoveryReason: 'EMAIL_PROOF_EXPIRED' | null;
  readonly requiresLegalReconfirmation: boolean;
  readonly legalRefreshNonce: number;
  readonly submitStatus: SignupSubmitStatus;
  readonly failure: SignupFailure | null;
}

export type SignupFlowAction =
  | { readonly type: 'GO_NEXT' }
  | { readonly type: 'GO_BACK' }
  | { readonly type: 'GO_TO_STEP'; readonly stepId: SignupStepId }
  | { readonly type: 'EMAIL_VERIFIED'; readonly verifiedAt: string }
  | { readonly type: 'EMAIL_PROOF_EXPIRED' }
  | { readonly type: 'LEGAL_ACCEPTANCES_STALE' }
  | { readonly type: 'LEGAL_RECONFIRMATION_STARTED' }
  | { readonly type: 'SUBMIT_STARTED' }
  | { readonly type: 'SUBMIT_SUCCEEDED' }
  | { readonly type: 'SUBMIT_FAILED'; readonly failure: SignupFailure }
  | { readonly type: 'FAILURE_CLEARED' }
  | { readonly type: 'RESET_FLOW' };

export const initialSignupFlowState: SignupFlowState = {
  currentStepId: 'EMAIL_VERIFICATION',
  isEmailVerified: false,
  emailVerifiedAt: null,
  recoveryReason: null,
  requiresLegalReconfirmation: false,
  legalRefreshNonce: 0,
  submitStatus: 'idle',
  failure: null,
};

function canMoveFromComplete(state: SignupFlowState): boolean {
  return state.currentStepId !== 'COMPLETE';
}

function targetStepForFailure(failure: SignupFailure, currentStepId: SignupStepId): SignupStepId {
  return failure.kind === 'field_error' ? failure.targetStepId : currentStepId;
}

export function signupFlowReducer(
  state: SignupFlowState,
  action: SignupFlowAction,
): SignupFlowState {
  switch (action.type) {
    case 'GO_NEXT':
      if (!canMoveFromComplete(state)) return state;
      return {
        ...state,
        currentStepId: getNextSignupStep(state.currentStepId),
        recoveryReason: null,
        failure: null,
      };

    case 'GO_BACK':
      if (!canMoveFromComplete(state)) return state;
      return {
        ...state,
        currentStepId: getPreviousSignupStep(state.currentStepId),
        recoveryReason: null,
        failure: null,
      };

    case 'GO_TO_STEP':
      if (!canMoveFromComplete(state) && action.stepId !== 'COMPLETE') return state;
      return { ...state, currentStepId: action.stepId, recoveryReason: null, failure: null };

    case 'EMAIL_VERIFIED':
      return {
        ...state,
        isEmailVerified: true,
        emailVerifiedAt: action.verifiedAt,
        recoveryReason: null,
        submitStatus: 'idle',
        failure: null,
      };

    case 'EMAIL_PROOF_EXPIRED':
      return {
        ...initialSignupFlowState,
        recoveryReason: 'EMAIL_PROOF_EXPIRED',
      };

    case 'LEGAL_ACCEPTANCES_STALE':
      return {
        ...state,
        currentStepId: 'LEGAL_CONSENT',
        requiresLegalReconfirmation: true,
        legalRefreshNonce: state.legalRefreshNonce + 1,
        submitStatus: 'idle',
        failure: null,
      };

    case 'LEGAL_RECONFIRMATION_STARTED':
      return { ...state, requiresLegalReconfirmation: false };

    case 'SUBMIT_STARTED':
      if (!canMoveFromComplete(state)) return state;
      return { ...state, submitStatus: 'submitting', failure: null };

    case 'SUBMIT_SUCCEEDED':
      return {
        ...state,
        currentStepId: 'COMPLETE',
        submitStatus: 'succeeded',
        failure: null,
      };

    case 'SUBMIT_FAILED':
      if (!canMoveFromComplete(state)) return state;
      if (
        action.failure.kind === 'field_error' &&
        action.failure.targetStepId === 'EMAIL_VERIFICATION'
      ) {
        return {
          ...state,
          currentStepId: 'EMAIL_VERIFICATION',
          isEmailVerified: false,
          emailVerifiedAt: null,
          submitStatus: 'failed',
          failure: action.failure,
        };
      }
      return {
        ...state,
        currentStepId: targetStepForFailure(action.failure, state.currentStepId),
        submitStatus: 'failed',
        failure: action.failure,
      };

    case 'FAILURE_CLEARED':
      return { ...state, submitStatus: 'idle', failure: null };

    case 'RESET_FLOW':
      return initialSignupFlowState;
  }
}
