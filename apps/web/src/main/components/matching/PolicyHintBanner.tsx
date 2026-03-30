'use client';

import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import type { PolicyCopy } from './policyCopy';

interface PolicyHintBannerProps {
  hint: PolicyCopy | null;
}

const TONE_STYLES = {
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  green: 'bg-green-50 border-green-200 text-green-900',
  slate: 'bg-slate-100 border-slate-200 text-slate-900',
} as const;

function ToneIcon({ tone }: { tone: PolicyCopy['tone'] }) {
  if (tone === 'amber') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  if (tone === 'green') return <ShieldAlert className="h-4 w-4 text-green-600" />;
  if (tone === 'slate') return <Info className="h-4 w-4 text-slate-600" />;
  return <Info className="h-4 w-4 text-blue-600" />;
}

export function PolicyHintBanner({ hint }: PolicyHintBannerProps) {
  if (!hint) return null;

  return (
    <div className={`rounded-xl border p-4 ${TONE_STYLES[hint.tone]}`}>
      <div className="flex items-start gap-2">
        <ToneIcon tone={hint.tone} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{hint.title}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{hint.body}</p>
        </div>
      </div>
    </div>
  );
}
