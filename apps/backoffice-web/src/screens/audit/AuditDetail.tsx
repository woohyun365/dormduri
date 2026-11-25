import type { AuditEvent } from '@repo/shared/backoffice';
import { formatKstDetail } from '@/ui/format';
import {
  auditActionLabel,
  auditActorLabel,
  auditResultLabel,
  RECOVERY_LOGIN_LABELS,
} from '@/ui/labels';
import { recoveryLoginMethod } from './audit-display';

function metadataText(metadata: unknown): string {
  if (typeof metadata !== 'object' || metadata === null) return '—';
  const entries = Object.entries(metadata as Record<string, unknown>);
  return entries.length
    ? entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ')
    : '—';
}

/** Every field of one audit row, ids in full so an auditor can match them with the session trail. */
export function AuditDetail({
  event,
  names,
}: {
  readonly event: AuditEvent;
  readonly names: Readonly<Record<string, string>>;
}) {
  const recovery = recoveryLoginMethod(event);
  const name = event.actorAccountId ? names[event.actorAccountId] : undefined;
  const rows: readonly [string, string][] = [
    ['시각', formatKstDetail(event.occurredAt)],
    [
      '행위자',
      event.actorAccountId
        ? name
          ? `${name} (${event.actorAccountId})`
          : event.actorAccountId
        : auditActorLabel(event.actorType),
    ],
    ['행동', recovery ? RECOVERY_LOGIN_LABELS[recovery] : auditActionLabel(event.action)],
    ['행동 code', event.action],
    ['결과', auditResultLabel(event.result)],
    ['대상', event.targetType ? `${event.targetType} ${event.targetId ?? ''}`.trim() : '—'],
    ['승인 요청', event.approvalRequestId ?? '—'],
    ['자기 승인', event.selfApproved ? '예' : '아니요'],
    ['사유·메모', event.reason ?? '—'],
    ['접속 session', event.sessionId ?? '—'],
    ['접속 경로', event.accessPath ?? '—'],
    ['요청 id', event.requestId ?? '—'],
    ['metadata', metadataText(event.metadata)],
  ];
  return (
    <dl className="grid grid-cols-1 gap-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-caption font-semibold text-fg-muted">{label}</dt>
          <dd className="text-body wrap-anywhere text-fg-neutral tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
