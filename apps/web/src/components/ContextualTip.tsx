'use client';

import { useEffect, useRef } from 'react';
import { Lightbulb } from 'lucide-react';

interface ContextualTipProps {
  message: string;
  onDismiss: () => void;
  autoHideMs?: number;
}

export function ContextualTip({ message, onDismiss, autoHideMs = 8000 }: ContextualTipProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (!dismissedRef.current) {
        dismissedRef.current = true;
        onDismiss();
      }
    }, autoHideMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [onDismiss, autoHideMs]);

  const handleClick = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onDismiss();
  };

  return (
    <div
      role="status"
      onClick={handleClick}
      className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer transition-opacity hover:opacity-80"
    >
      <Lightbulb className="w-4 h-4 text-blue-500 shrink-0" />
      <p className="text-sm text-blue-800">{message}</p>
    </div>
  );
}
