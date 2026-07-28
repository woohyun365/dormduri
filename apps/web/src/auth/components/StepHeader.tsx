import type { ReactNode, Ref } from 'react';

interface StepHeaderProps {
  icon: ReactNode;
  title: string;
  description?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}

export function StepHeader({ icon, title, description, headingRef }: StepHeaderProps) {
  return (
    <div className="text-center mb-8">
      <div className="w-16 h-16 bg-(--knu-primary-light) rounded-2xl flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl md:text-3xl font-bold text-(--knu-text-primary) mb-2"
      >
        {title}
      </h2>
      {description ? <p className="keep-all text-(--knu-text-secondary)">{description}</p> : null}
    </div>
  );
}
