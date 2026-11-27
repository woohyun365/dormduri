import type { AuditEvent } from '@repo/shared/backoffice';
import { formatKstSeconds, shortId } from '@/ui/format';
import { Icon } from '@/ui/icons';
import {
  auditActionLabel,
  auditActorLabel,
  auditResultLabel,
  auditTargetLabel,
  RECOVERY_LOGIN_LABELS,
} from '@/ui/labels';
import { auditResultMeaning, StatusBadge } from '@/ui/status';
import { TD, TH, TableRegion } from '@/ui/table';
import { TimeText } from '@/ui/text';
import { recoveryLoginMethod } from './audit-display';

type Names = Readonly<Record<string, string>>;

/** Who acted: the operator's name for the owner role, the short account id for an auditor, the actor kind otherwise. */
export function auditActor(event: AuditEvent, names: Names): string {
  if (!event.actorAccountId) return auditActorLabel(event.actorType);
  return names[event.actorAccountId] ?? shortId(event.actorAccountId);
}

function ActionText({ event }: { readonly event: AuditEvent }) {
  const recovery = recoveryLoginMethod(event);
  return recovery ? (
    <StatusBadge meaning="warning">{RECOVERY_LOGIN_LABELS[recovery]}</StatusBadge>
  ) : (
    <>{auditActionLabel(event.action)}</>
  );
}

/**
 * Admin audit rows, newest first (OA-R7). Rows hold account ids, never user personal data. A recovery login is named by
 * its second factor so the monthly review tells it from a passkey login. The time in the first column opens the row's
 * detail (it stays in view when the table scrolls).
 */
export function AuditTable({
  events,
  names,
  onOpen,
}: {
  readonly events: readonly AuditEvent[];
  readonly names: Names;
  readonly onOpen: (eventId: string) => void;
}) {
  return (
    <TableRegion label="감사 기록 표">
      <table className="w-full min-w-192 border-t border-stroke-subtle lg:max-xl:min-w-0">
        <caption className="sr-only">관리자 감사 기록, 최신순</caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              시각(KST)
            </th>
            <th scope="col" className={TH}>
              행위자
            </th>
            <th scope="col" className={TH}>
              행동
            </th>
            <th scope="col" className={TH}>
              대상
            </th>
            <th scope="col" className={TH}>
              결과
            </th>
            <th scope="col" className={TH}>
              비고
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke-row">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-layer-muted">
              <td className={`${TD} whitespace-nowrap lg:max-xl:whitespace-normal`}>
                <button
                  type="button"
                  onClick={() => onOpen(event.id)}
                  className="inline-flex items-center gap-1 rounded-control font-medium text-fg-brand tabular-nums underline-offset-4 hover:underline focus-ring"
                >
                  <TimeText text={formatKstSeconds(event.occurredAt)} />
                  <span className="sr-only"> 기록 상세</span>
                  <Icon name="arrow" className="size-3.5" />
                </button>
              </td>
              <td className={`${TD} min-w-40 font-semibold wrap-anywhere lg:max-xl:min-w-28`}>
                {auditActor(event, names)}
              </td>
              <td className={`${TD} whitespace-nowrap lg:max-xl:whitespace-normal`}>
                <ActionText event={event} />
              </td>
              <td
                className={`${TD} whitespace-nowrap text-fg-description lg:max-xl:whitespace-normal`}
              >
                {event.targetType ? (
                  <>
                    {auditTargetLabel(event.targetType)}{' '}
                    <span className="tabular-nums">{shortId(event.targetId)}</span>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className={TD}>
                <StatusBadge meaning={auditResultMeaning(event.result)}>
                  {auditResultLabel(event.result)}
                </StatusBadge>
              </td>
              <td className={`${TD} min-w-48 text-fg-description lg:max-xl:min-w-36`}>
                {/* The self-approval mark keeps a line of its own above the reason (design guide ⑥). */}
                <span className="flex flex-col items-start gap-1">
                  {event.selfApproved ? (
                    <StatusBadge meaning="warning">자기 승인</StatusBadge>
                  ) : null}
                  {event.reason ?? (event.selfApproved ? null : '—')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}
