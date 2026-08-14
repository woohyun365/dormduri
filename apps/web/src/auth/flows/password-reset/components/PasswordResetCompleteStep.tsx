import { useEffect, useRef } from 'react';
import { CheckCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

interface PasswordResetCompleteStepProps {
  onGoToLogin: () => void;
}

export function PasswordResetCompleteStep({ onGoToLogin }: PasswordResetCompleteStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    focusAndScroll(headingRef.current);
  }, []);

  return (
    <div className="space-y-5 py-4 text-center sm:py-6">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle className="size-7 text-emerald-600" aria-hidden="true" />
      </div>

      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-(--knu-text-primary)">
          {PASSWORD_RESET_COPY.complete.title}
        </h2>
        <p className="mt-1.5 keep-all text-sm leading-6 text-(--knu-text-secondary)">
          {PASSWORD_RESET_COPY.complete.description}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
        <LogOut className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span>{PASSWORD_RESET_COPY.complete.sessionEnded}</span>
      </div>

      <Button variant="primary" size="lg" fullWidth onClick={onGoToLogin}>
        {PASSWORD_RESET_COPY.complete.login}
      </Button>
    </div>
  );
}
