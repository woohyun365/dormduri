import type { ReactNode } from 'react';

interface SignupStepFrameProps {
  children: ReactNode;
  progress?: ReactNode;
  alert?: ReactNode;
}

export function SignupStepFrame({ children, progress, alert }: SignupStepFrameProps) {
  return (
    <div className="space-y-8">
      {progress && <div>{progress}</div>}
      {alert}
      <section className="rounded-4xl border border-(--knu-border) bg-white p-5 shadow-sm sm:p-8">
        {children}
      </section>
    </div>
  );
}
