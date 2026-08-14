'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import { AuthFeedbackStrip, type AuthFeedbackVariant } from './AuthFeedbackStrip';

interface AuthActionFeedbackProps {
  variant: AuthFeedbackVariant;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  role?: 'alert' | 'status';
  className?: string;
  testId?: string;
  children?: ReactNode;
}

export function AuthActionFeedback({
  variant,
  title,
  description,
  aside,
  role = 'alert',
  className,
  testId,
  children,
}: AuthActionFeedbackProps) {
  const titleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    focusAndScroll(titleRef.current);
  }, [title]);

  return (
    <AuthFeedbackStrip
      variant={variant}
      title={title}
      description={description}
      aside={aside}
      role={role}
      titleRef={titleRef}
      titleTabIndex={-1}
      className={className}
      testId={testId}
    >
      {children}
    </AuthFeedbackStrip>
  );
}
