import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import type { ReactNode } from 'react';

type RoommateActionConfirmationTone = 'amber' | 'indigo' | 'red';

interface RoommateActionConfirmationDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly headline: string;
  readonly noticeTitle: string;
  readonly noticeItems: readonly string[];
  readonly tone: RoommateActionConfirmationTone;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

const TONE_STYLES: Record<
  RoommateActionConfirmationTone,
  {
    readonly card: string;
    readonly noticeTitle: string;
    readonly bullet: string;
  }
> = {
  amber: {
    card: 'border-amber-100 bg-amber-50/70',
    noticeTitle: 'text-amber-700',
    bullet: 'bg-amber-500',
  },
  indigo: {
    card: 'border-indigo-100 bg-indigo-50/70',
    noticeTitle: 'text-indigo-700',
    bullet: 'bg-indigo-500',
  },
  red: {
    card: 'border-red-100 bg-red-50/70',
    noticeTitle: 'text-red-700',
    bullet: 'bg-red-500',
  },
};

export function RoommateActionConfirmationDialog({
  isOpen,
  title,
  headline,
  noticeTitle,
  noticeItems,
  tone,
  onClose,
  children,
}: RoommateActionConfirmationDialogProps) {
  const styles = TONE_STYLES[tone];

  return (
    <BaseBottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5 px-5 py-5">
        <section className={`rounded-3xl border p-4 ${styles.card}`}>
          <p className="text-sm font-bold text-(--knu-text-primary)">{headline}</p>
          <p className={`mt-3 text-xs font-bold ${styles.noticeTitle}`}>{noticeTitle}</p>
          <ul className="mt-2 space-y-2">
            {noticeItems.map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-5 text-(--knu-text-secondary)">
                <span
                  className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${styles.bullet}`}
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
        {children}
      </div>
    </BaseBottomSheet>
  );
}
