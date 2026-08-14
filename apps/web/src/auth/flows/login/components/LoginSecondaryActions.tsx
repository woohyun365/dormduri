import Link from 'next/link';
import { Mail } from 'lucide-react';
import { AuthServiceNotice } from '@/auth/components';
import { Button } from '@/components/ui/Button';

export function LoginPasswordResetAction({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative inline-flex h-5 shrink-0 items-start justify-end rounded-md px-1.5 text-sm font-semibold leading-5 text-(--knu-primary) transition-colors before:absolute before:-inset-x-1 before:-inset-y-2 before:rounded-lg before:content-[''] hover:bg-indigo-50 hover:text-(--knu-primary-hover) disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
    >
      비밀번호 찾기
    </button>
  );
}

export function LoginSignupAction({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-6 text-center">
      <p className="mb-4 text-(--knu-text-secondary)">아직 계정이 없으신가요?</p>
      <Button variant="outline" size="lg" fullWidth onClick={onClick}>
        <Mail className="h-5 w-5" />
        이메일로 회원가입
      </Button>
    </div>
  );
}

export function LoginLegalFooter() {
  return (
    <footer className="mt-8 text-center md:mt-[27px]">
      <AuthServiceNotice
        className="mb-4 hidden text-center md:block"
        copyVariant="full"
        showDetailsLink={false}
      />
      <div className="border-t border-(--knu-border) pt-3">
        <nav
          aria-label="법적 안내"
          className="inline-flex items-center justify-center gap-3 text-sm"
        >
          <Link
            href="/terms"
            className="px-1 py-2 text-(--knu-text-tertiary) transition-colors hover:text-(--knu-primary)"
          >
            이용약관
          </Link>
          <span className="h-3 w-px bg-slate-300" aria-hidden="true" />
          <Link
            href="/privacy"
            className="px-1 py-2 text-(--knu-text-tertiary) transition-colors hover:text-(--knu-primary)"
          >
            개인정보처리방침
          </Link>
        </nav>
      </div>
    </footer>
  );
}
