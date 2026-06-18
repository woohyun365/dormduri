'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import type { PolicyCopy } from './policyCopy';

const CYCLE_INTERVAL = 5000; // 5초

interface PolicyHintBannerProps {
  /** 단일 힌트 (기존 호환) */
  hint?: PolicyCopy | null;
  /** 순환 힌트 배열 (우선) */
  hints?: PolicyCopy[];
}

const TONE_STYLES = {
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  green: 'bg-green-50 border-green-200 text-green-900',
  slate: 'bg-slate-100 border-slate-200 text-slate-900',
} as const;

const SIGNATURE_SEPARATOR = '\u001f';

function ToneIcon({ tone }: { tone: PolicyCopy['tone'] }) {
  if (tone === 'amber') return <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />;
  if (tone === 'green') return <ShieldAlert className="h-4 w-4 text-green-600 flex-shrink-0" />;
  if (tone === 'slate') return <Info className="h-4 w-4 text-slate-600 flex-shrink-0" />;
  return <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />;
}

export function PolicyHintBanner({ hint, hints }: PolicyHintBannerProps) {
  // 힌트 배열 결정: hints prop 우선, 없으면 hint 단건
  const items = hints && hints.length > 0 ? hints : hint ? [hint] : [];

  const itemsSignature = items
    .map(
      (item) => `${item.tone}${SIGNATURE_SEPARATOR}${item.title}${SIGNATURE_SEPARATOR}${item.body}`,
    )
    .join(SIGNATURE_SEPARATOR);
  const [rotation, setRotation] = useState({ signature: '', index: 0 });
  const index = rotation.signature === itemsSignature ? rotation.index : 0;

  // 순환 타이머
  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setRotation((prev) => {
        const previousIndex = prev.signature === itemsSignature ? prev.index : 0;
        return {
          signature: itemsSignature,
          index: (previousIndex + 1) % items.length,
        };
      });
    }, CYCLE_INTERVAL);
    return () => clearInterval(timer);
  }, [items.length, itemsSignature]);

  if (items.length === 0) return null;

  const current = items[index % items.length]!;

  return (
    <div className="relative h-[4.5rem]">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${index}-${current.title}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className={`absolute inset-0 rounded-xl border p-3 ${TONE_STYLES[current.tone]}`}
        >
          <div className="flex items-start gap-2">
            <ToneIcon tone={current.tone} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">{current.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed opacity-90 line-clamp-1">
                {current.body}
              </p>
            </div>
            {items.length > 1 && (
              <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                {items.slice(0, 3).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setRotation({ signature: itemsSignature, index: i })}
                    className={`rounded-full transition-all ${
                      i === index % items.length
                        ? 'w-4 h-1.5 bg-current opacity-60'
                        : 'w-1.5 h-1.5 bg-current opacity-25'
                    }`}
                    aria-label={`팁 ${i + 1}`}
                  />
                ))}
                {items.length > 3 && (
                  <span className="text-[8px] opacity-40 ml-0.5">+{items.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
