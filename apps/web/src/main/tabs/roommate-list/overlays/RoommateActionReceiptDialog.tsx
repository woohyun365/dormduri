import { Ban, CheckCircle2, Flag, type LucideIcon } from 'lucide-react';
import type { RoommateActionReceipt } from '../hooks/useRoommateActions';

interface RoommateActionReceiptDialogProps {
  readonly receipt: RoommateActionReceipt | null;
  readonly onDismiss: () => void;
}

export function RoommateActionReceiptDialog({
  receipt,
  onDismiss,
}: RoommateActionReceiptDialogProps) {
  if (!receipt) return null;
  const content = resolveReceiptDialogContent(receipt);

  return <RoommateActionReceiptDialogShell {...content} onDismiss={onDismiss} />;
}

interface RoommateActionReceiptNoticeSection {
  readonly title: string;
  readonly items: readonly string[];
}

interface RoommateActionReceiptDialogContent {
  readonly Icon: LucideIcon;
  readonly title: string;
  readonly counterpartNickname?: string;
  readonly counterpartSuffix: string;
  readonly noticeSections: readonly RoommateActionReceiptNoticeSection[];
  readonly iconClassName: string;
  readonly borderClassName: string;
}

export interface RoommateActionReceiptDialogShellProps extends RoommateActionReceiptDialogContent {
  readonly onDismiss: () => void;
  readonly description?: string;
}

export function RoommateActionReceiptDialogShell({
  Icon,
  title,
  counterpartNickname,
  counterpartSuffix,
  noticeSections,
  iconClassName,
  borderClassName,
  onDismiss,
  description,
}: RoommateActionReceiptDialogShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-5 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="roommate-action-receipt-title"
        className={`w-full max-w-sm rounded-3xl border bg-white p-5 text-center shadow-2xl ${borderClassName}`}
      >
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${iconClassName}`}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        {counterpartNickname ? (
          <p className="mt-4 text-sm text-(--knu-text-secondary)">
            <strong className="font-bold text-(--knu-text-primary)">{counterpartNickname}</strong>
            {counterpartSuffix}
          </p>
        ) : null}
        <h2
          id="roommate-action-receipt-title"
          className="mt-2 text-base font-bold text-(--knu-text-primary)"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">{description}</p>
        ) : null}
        {noticeSections.length > 0 ? (
          <div className="mt-4 space-y-3 text-left">
            {noticeSections.map((section) => (
              <NoticeCard key={section.title} section={section} />
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white transition hover:bg-(--knu-primary-hover)"
        >
          확인
        </button>
      </section>
    </div>
  );
}

function NoticeCard({ section }: { readonly section: RoommateActionReceiptNoticeSection }) {
  return (
    <div className="rounded-2xl bg-(--knu-background-alt) p-4">
      <p className="text-xs font-bold text-(--knu-text-primary)">{section.title}</p>
      <ul className="mt-2 space-y-2">
        {section.items.map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-5 text-(--knu-text-secondary)">
            <span
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-(--knu-primary)"
              aria-hidden
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function resolveReceiptDialogContent(
  receipt: RoommateActionReceipt,
): RoommateActionReceiptDialogContent {
  if (receipt.actionKind === 'block') {
    return {
      Icon: Ban,
      title: receipt.title,
      counterpartNickname: receipt.counterpartNickname,
      counterpartSuffix: '님에 대한',
      noticeSections: [
        {
          title: '차단 후 알아야 할 사항',
          items: splitReceiptMessage(receipt.message),
        },
      ],
      iconClassName: 'bg-red-50 text-red-600',
      borderClassName: 'border-red-100',
    };
  }

  if (receipt.actionKind === 'report') {
    return {
      Icon: Flag,
      title: receipt.title,
      counterpartNickname: receipt.counterpartNickname,
      counterpartSuffix: '님에 대한',
      noticeSections: [
        {
          title: '신고 접수 후 알아야 할 사항',
          items: splitReceiptMessage(receipt.message),
        },
        ...(receipt.secondaryNotice
          ? [
              {
                title: receipt.secondaryNotice.title,
                items: splitReceiptMessage(receipt.secondaryNotice.message),
              },
            ]
          : []),
      ],
      iconClassName: 'bg-amber-50 text-amber-600',
      borderClassName: 'border-amber-100',
    };
  }

  return {
    Icon: CheckCircle2,
    title: receipt.title,
    counterpartNickname: receipt.counterpartNickname,
    counterpartSuffix: '님에게',
    noticeSections: [
      {
        title: '매칭 요청 후 알아야 할 사항',
        items: splitReceiptMessage(receipt.message),
      },
    ],
    iconClassName: 'bg-emerald-50 text-emerald-600',
    borderClassName: 'border-emerald-100',
  };
}

function splitReceiptMessage(message: string): readonly string[] {
  const items = message
    .split(/\n+/u)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : [message];
}
