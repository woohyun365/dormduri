'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { PrimaryPolicyHint } from './model/primaryTypes';

const POLICY_HINT_ROTATION_MS = 5000;
const POLICY_HINT_SIGNATURE_SEPARATOR = '\u001f';

export function PrimaryPolicyHintRotator({
  hints,
  ariaLabelPrefix = '이용 안내',
}: {
  hints: PrimaryPolicyHint[];
  ariaLabelPrefix?: string;
}) {
  const hintsSignature = hints
    .map(
      (hint) =>
        `${hint.label}${POLICY_HINT_SIGNATURE_SEPARATOR}${hint.text}${POLICY_HINT_SIGNATURE_SEPARATOR}${hint.iconClassName}`,
    )
    .join(POLICY_HINT_SIGNATURE_SEPARATOR);
  const [rotation, setRotation] = useState({ signature: hintsSignature, index: 0 });
  const currentIndex = rotation.signature === hintsSignature ? rotation.index : 0;

  useEffect(() => {
    if (hints.length <= 1) return;

    const timer = setInterval(() => {
      setRotation((prev) => {
        const previousIndex = prev.signature === hintsSignature ? prev.index : 0;

        return {
          signature: hintsSignature,
          index: (previousIndex + 1) % hints.length,
        };
      });
    }, POLICY_HINT_ROTATION_MS);

    return () => clearInterval(timer);
  }, [hints.length, hintsSignature]);

  const currentHint = hints[currentIndex % hints.length];
  if (!currentHint) return null;

  const HintIcon = currentHint.icon;

  return (
    <div
      className="relative min-h-19 overflow-hidden rounded-xl border border-white/70 bg-white/65 shadow-sm shadow-slate-200/50 backdrop-blur-sm sm:min-h-16"
      data-testid="home-primary-policy-hint"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentIndex}-${currentHint.label}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          data-active-policy-hint-index={currentIndex % hints.length}
          className="absolute inset-0 flex items-center gap-3 p-3"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/85 shadow-sm shadow-slate-200/50 ${currentHint.iconClassName}`}
          >
            <HintIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-500">{currentHint.label}</p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-700">
              {currentHint.text}
            </p>
          </div>
          {hints.length > 1 && (
            <div
              className="flex shrink-0 items-center gap-1"
              aria-label={`${ariaLabelPrefix} 순서`}
            >
              {hints.map((hint, index) => (
                <button
                  key={hint.label}
                  type="button"
                  onClick={() => setRotation({ signature: hintsSignature, index })}
                  className={`rounded-full transition-all ${
                    index === currentIndex % hints.length
                      ? 'h-1.5 w-4 bg-slate-600/70'
                      : 'h-1.5 w-1.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`${ariaLabelPrefix} ${index + 1}: ${hint.label}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
