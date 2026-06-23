import { SignupLayout } from './SignupLayout';

export function SignupLoadingSkeleton() {
  return (
    <SignupLayout showServiceNotice={false}>
      <div
        role="status"
        aria-live="polite"
        className="space-y-6 rounded-4xl border border-(--knu-border) bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold text-(--knu-primary)">
            회원가입 정보를 준비하고 있어요.
          </p>
          <p className="text-sm leading-6 text-(--knu-text-secondary)">
            인증 상태와 임시 저장된 입력값을 확인한 뒤 이어서 진행할게요.
          </p>
        </div>
        <div className="space-y-3" aria-hidden="true">
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-gray-200" />
          <div className="h-3 w-full animate-pulse rounded-full bg-gray-100" />
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-gray-100" />
        </div>
      </div>
    </SignupLayout>
  );
}
