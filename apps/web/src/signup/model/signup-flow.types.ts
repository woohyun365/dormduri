export type SignupStepId = 'EMAIL_VERIFICATION' | 'LEGAL_CONSENT' | 'ACCOUNT_IDENTITY' | 'COMPLETE';

export interface SignupStepDefinition {
  readonly id: SignupStepId;
  readonly order: number;
  readonly label: string;
  readonly description: string;
  readonly isTerminal: boolean;
}

export const SIGNUP_STEPS = [
  {
    id: 'EMAIL_VERIFICATION',
    order: 1,
    label: '이메일 인증',
    description: '강원대학교 이메일로 가입 가능 여부를 확인합니다.',
    isTerminal: false,
  },
  {
    id: 'LEGAL_CONSENT',
    order: 2,
    label: '약관 확인',
    description: '필수 약관과 개인정보 수집·이용 동의를 확인합니다.',
    isTerminal: false,
  },
  {
    id: 'ACCOUNT_IDENTITY',
    order: 3,
    label: '계정 정보',
    description: '닉네임, 비밀번호, 성별, 캠퍼스, 단과대학, 출생연도를 입력합니다.',
    isTerminal: false,
  },
  {
    id: 'COMPLETE',
    order: 4,
    label: '가입 완료',
    description: '계정 생성이 완료되었음을 안내합니다.',
    isTerminal: true,
  },
] as const satisfies readonly SignupStepDefinition[];

export const SIGNUP_STEP_COUNT = SIGNUP_STEPS.length;

const SIGNUP_STEP_INDEX_BY_ID = new Map<SignupStepId, number>(
  SIGNUP_STEPS.map((step, index) => [step.id, index]),
);

export function getSignupStepIndex(stepId: SignupStepId): number {
  const index = SIGNUP_STEP_INDEX_BY_ID.get(stepId);
  if (index === undefined) {
    throw new Error(`Unknown signup step: ${stepId}`);
  }
  return index;
}

export function getSignupStepProgress(stepId: SignupStepId) {
  const currentStep = getSignupStepIndex(stepId) + 1;

  return {
    currentStep,
    totalSteps: SIGNUP_STEP_COUNT,
    percent: Math.round((currentStep / SIGNUP_STEP_COUNT) * 100),
  };
}

export function getNextSignupStep(stepId: SignupStepId): SignupStepId {
  const currentIndex = getSignupStepIndex(stepId);
  return SIGNUP_STEPS[Math.min(currentIndex + 1, SIGNUP_STEPS.length - 1)]!.id;
}

export function getPreviousSignupStep(stepId: SignupStepId): SignupStepId {
  const currentIndex = getSignupStepIndex(stepId);
  return SIGNUP_STEPS[Math.max(currentIndex - 1, 0)]!.id;
}
