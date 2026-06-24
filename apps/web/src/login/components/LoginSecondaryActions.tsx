import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button } from '@/components/Button';

interface LoginSecondaryActionsProps {
  onPasswordResetClick: () => void;
  onSignupClick: () => void;
}

export function LoginPasswordResetAction({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-[var(--knu-primary)] transition-colors hover:text-[var(--knu-primary-hover)]"
    >
      비밀번호 찾기
    </button>
  );
}

export function LoginSignupAction({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-6 text-center">
      <p className="mb-4 text-[var(--knu-text-secondary)]">아직 계정이 없으신가요?</p>
      <Button variant="outline" size="lg" fullWidth onClick={onClick}>
        <Mail className="h-5 w-5" />
        이메일로 회원가입
      </Button>
    </div>
  );
}

export function LoginLegalLinks() {
  return (
    <div className="mt-12 border-t border-[var(--knu-border)] pt-8 text-center">
      <div className="flex items-center justify-center gap-6 text-sm">
        <Link
          href="/terms"
          className="flex-1 text-right text-[var(--knu-text-tertiary)] transition-colors hover:text-[var(--knu-primary)]"
        >
          이용약관
        </Link>
        <span className="text-[var(--knu-text-tertiary)]">|</span>
        <Link
          href="/privacy"
          className="flex-1 text-left text-[var(--knu-text-tertiary)] transition-colors hover:text-[var(--knu-primary)]"
        >
          개인정보처리방침
        </Link>
      </div>
    </div>
  );
}

export function LoginSecondaryActions({
  onPasswordResetClick,
  onSignupClick,
}: LoginSecondaryActionsProps) {
  return (
    <>
      <LoginPasswordResetAction onClick={onPasswordResetClick} />
      <LoginSignupAction onClick={onSignupClick} />
      <LoginLegalLinks />
    </>
  );
}
