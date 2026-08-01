import { AuthServiceNotice, AuthSupportPanel } from '@/auth/components';
import { SIGNUP_STEPS } from '../model/signup-flow.types';

const SUPPORT_CONTENT = {
  1: {
    title: '학교 이메일을 확인해요',
    description: '메일함과 스팸함을 확인하고 인증 코드를 입력해요.',
  },
  2: {
    title: '가입 전 필수 내용을 확인해요',
    description: '이용약관과 개인정보 수집·이용 내용을 확인해 주세요.',
  },
  3: {
    title: '로그인 정보를 만들어요',
    description: '서비스에서 사용할 닉네임과 비밀번호를 입력해요.',
  },
  4: {
    title: '기본 정보를 확인해요',
    description: '서비스 이용에 필요한 최소한의 기본 정보를 입력해요.',
  },
  5: {
    title: '가입을 마쳤어요',
    description: '메인에서 지금 이용할 수 있는 기능을 확인해요.',
  },
} as const;

interface SignupSupportPanelProps {
  currentStep: number;
  showServiceNotice: boolean;
}

export function SignupSupportPanel({ currentStep, showServiceNotice }: SignupSupportPanelProps) {
  const safeCurrentStep = Math.min(Math.max(currentStep, 1), SIGNUP_STEPS.length);
  const content =
    SUPPORT_CONTENT[safeCurrentStep as keyof typeof SUPPORT_CONTENT] ?? SUPPORT_CONTENT[1];
  const isFlowComplete = safeCurrentStep === SIGNUP_STEPS.length;

  return (
    <AuthSupportPanel
      eyebrow="회원가입"
      titleId="signup-help-title"
      title={content.title}
      description={content.description}
      steps={SIGNUP_STEPS}
      currentStep={safeCurrentStep}
      isComplete={isFlowComplete}
      navigationLabel="회원가입 진행 단계"
      footer={
        showServiceNotice ? (
          <AuthServiceNotice className="border-t border-(--knu-border) pt-5 text-left" />
        ) : undefined
      }
    />
  );
}
