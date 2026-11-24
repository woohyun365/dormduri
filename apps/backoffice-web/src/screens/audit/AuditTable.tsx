import type { AuditEvent } from '@repo/shared/backoffice';
import { formatKst, shortId } from '@/ui/format';
import { auditActionLabel, auditActorLabel, auditResultLabel } from '@/ui/labels';

/** Admin audit rows, newest first (OA-R7). Rows hold account ids, never user personal data. */
export function AuditTable({
  events,
  names,
}: {
  readonly events: readonly AuditEvent[];
  readonly names: Readonly<Record<string, string>>;
}) {
  if (events.length === 0) {
    return <p className="text-body text-fg-description">기록이 없습니다.</p>;
  }
  return (
    <table className="w-full text-left text-body">
      <caption className="sr-only">관리자 감사 기록, 최신순</caption>
      <thead className="text-fg-description">
        <tr>
          <th scope="col" className="py-2">
            시각
          </th>
          <th scope="col">행위자</th>
          <th scope="col">행동</th>
          <th scope="col">대상</th>
          <th scope="col">결과</th>
          <th scope="col">비고</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-stroke-row">
        {events.map((event) => (
          <tr key={event.id}>
            <td className="py-2 whitespace-nowrap">{formatKst(event.occurredAt)}</td>
            <td>
              {auditActorLabel(event.actorType)}
              {event.actorAccountId
                ? ` ${names[event.actorAccountId] ?? shortId(event.actorAccountId)}`
                : ''}
            </td>
            <td>{auditActionLabel(event.action)}</td>
            <td>{event.targetType ? `${event.targetType} ${shortId(event.targetId)}` : '—'}</td>
            <td>{auditResultLabel(event.result)}</td>
            <td>
              {event.selfApproved ? '자기 승인 ' : ''}
              {event.reason ?? ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
