import { getNextSignupStep, getPreviousSignupStep, type SignupStepId } from './signup-flow.types';

export type SignupSubmitStatus = 'idle' | 'submitting' | 'succeeded' | 'failed';

export interface SignupFlowState {
  readonly currentStepId: SignupStepId;
  readonly isEmailVerified: boolean;
  readonly resumeStepAfterVerification: SignupStepId | null;
  readonly legalNotice: string;
  readonly legalRefreshNonce: number;
  readonly submitStatus: SignupSubmitStatus;
  readonly submitError: string;
}

export type SignupFlowAction =
  | { readonly type: 'GO_NEXT' }
  | { readonly type: 'GO_BACK' }
  | { readonly type: 'GO_TO_STEP'; readonly stepId: SignupStepId }
  | { readonly type: 'EMAIL_CHANGED' }
  | { readonly type: 'EMAIL_VERIFIED' }
  | { readonly type: 'EMAIL_VERIFICATION_EXPIRED'; readonly resumeStepId?: SignupStepId }
  | { readonly type: 'LEGAL_ACCEPTANCES_STALE'; readonly notice?: string }
  | { readonly type: 'LEGAL_NOTICE_DISMISSED' }
  | { readonly type: 'SUBMIT_STARTED' }
  | { readonly type: 'SUBMIT_SUCCEEDED' }
  | { readonly type: 'SUBMIT_FAILED'; readonly error: string }
  | { readonly type: 'RESET_FLOW' };

export const DEFAULT_LEGAL_ACCEPTANCE_STALE_NOTICE =
  '약관 또는 개인정보 동의 내용이 변경되었습니다. 최신 내용을 다시 확인하고 필수 항목에 다시 동의해주세요.';

export const initialSignupFlowState: SignupFlowState = {
  currentStepId: 'EMAIL_VERIFICATION',
  isEmailVerified: false,
  resumeStepAfterVerification: null,
  legalNotice: '',
  legalRefreshNonce: 0,
  submitStatus: 'idle',
  submitError: '',
};

function canMoveFromComplete(state: SignupFlowState): boolean {
  return state.currentStepId !== 'COMPLETE';
}

export function signupFlowReducer(
  state: SignupFlowState,
  action: SignupFlowAction,
): SignupFlowState {
  switch (action.type) {
    case 'GO_NEXT':
      if (!canMoveFromComplete(state)) return state;
      return { ...state, currentStepId: getNextSignupStep(state.currentStepId) };

    case 'GO_BACK':
      if (!canMoveFromComplete(state)) return state;
      return { ...state, currentStepId: getPreviousSignupStep(state.currentStepId) };

    case 'GO_TO_STEP':
      if (!canMoveFromComplete(state) && action.stepId !== 'COMPLETE') return state;
      return { ...state, currentStepId: action.stepId };

    case 'EMAIL_CHANGED':
      return {
        ...state,
        currentStepId: 'EMAIL_VERIFICATION',
        isEmailVerified: false,
        resumeStepAfterVerification: null,
        submitError: '',
      };

    case 'EMAIL_VERIFIED':
      return {
        ...state,
        isEmailVerified: true,
        currentStepId: state.resumeStepAfterVerification ?? state.currentStepId,
        resumeStepAfterVerification: null,
        submitError: '',
      };

    case 'EMAIL_VERIFICATION_EXPIRED':
      return {
        ...state,
        currentStepId: 'EMAIL_VERIFICATION',
        isEmailVerified: false,
        resumeStepAfterVerification: action.resumeStepId ?? state.currentStepId,
        submitStatus: 'failed',
        submitError: '이메일 인증을 먼저 완료해주세요.',
      };

    case 'LEGAL_ACCEPTANCES_STALE':
      return {
        ...state,
        currentStepId: 'LEGAL_CONSENT',
        legalNotice: action.notice ?? DEFAULT_LEGAL_ACCEPTANCE_STALE_NOTICE,
        legalRefreshNonce: state.legalRefreshNonce + 1,
        submitStatus: 'idle',
        submitError: '',
      };

    case 'LEGAL_NOTICE_DISMISSED':
      return { ...state, legalNotice: '' };

    case 'SUBMIT_STARTED':
      if (!canMoveFromComplete(state)) return state;
      return { ...state, submitStatus: 'submitting', submitError: '' };

    case 'SUBMIT_SUCCEEDED':
      return {
        ...state,
        currentStepId: 'COMPLETE',
        submitStatus: 'succeeded',
        submitError: '',
      };

    case 'SUBMIT_FAILED':
      if (!canMoveFromComplete(state)) return state;
      return { ...state, submitStatus: 'failed', submitError: action.error };

    case 'RESET_FLOW':
      return initialSignupFlowState;
  }
}
