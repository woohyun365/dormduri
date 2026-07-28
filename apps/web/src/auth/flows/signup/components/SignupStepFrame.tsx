import type { ReactNode } from 'react';

interface SignupStepFrameProps {
  children: ReactNode;
  progress?: ReactNode;
}

export function SignupStepFrame({ children, progress }: SignupStepFrameProps) {
  return (
    <div className="space-y-6">
      {progress && <div className="lg:hidden">{progress}</div>}
      <section className="-mx-5 border-y border-(--knu-border) bg-white p-5 sm:mx-0 sm:rounded-4xl sm:border sm:p-8 sm:shadow-sm">
        {children}
      </section>
    </div>
  );
}
