import type { NoticeSeverity } from '@repo/shared/notices';

const NOTICE_SEVERITY_LABEL: Record<NoticeSeverity, string> = {
  INFO: '공지',
  WARNING: '확인 필요',
  CRITICAL: '중요',
  MAINTENANCE: '점검',
};

const NOTICE_SEVERITY_CLASS_NAME: Record<NoticeSeverity, string> = {
  INFO: 'bg-blue-100 text-blue-700',
  WARNING: 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-red-100 text-red-700',
  MAINTENANCE: 'bg-slate-200 text-slate-700',
};

export function NoticeSeverityChip({ severity }: { severity: NoticeSeverity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${NOTICE_SEVERITY_CLASS_NAME[severity]}`}
    >
      {NOTICE_SEVERITY_LABEL[severity]}
    </span>
  );
}
