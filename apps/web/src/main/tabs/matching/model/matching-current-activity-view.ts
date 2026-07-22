import type { CurrentMatchActivityEntry } from '@repo/shared/match/contract';

export type CurrentMatchActivityItemView =
  | {
      readonly id: string;
      readonly kind: 'entry';
      readonly entry: CurrentMatchActivityEntryView;
    }
  | {
      readonly id: string;
      readonly kind: 'auto-closed-group';
      readonly cause:
        | 'VIEWER_MATCHED'
        | 'COUNTERPART_MATCHED'
        | 'PARTICIPATION_CANCELLED'
        | 'PRECONDITION_FAILED';
      readonly entries: readonly CurrentMatchActivityEntryView[];
    };

export interface CurrentMatchActivityEntryView {
  readonly id: string;
  readonly result: CurrentMatchActivityEntry['result'];
  readonly title: string;
  readonly detail: string;
  readonly nickname: string;
  readonly directionLabel: '보낸 요청' | '받은 요청';
  readonly occurredAt: string;
  readonly dateLabel: string;
  readonly systemCancellationCause: CurrentMatchActivityEntry['systemCancellationCause'];
  readonly systemCancellationGroupId: string | null;
  readonly requestTerminalReason: CurrentMatchActivityEntry['requestTerminalReason'];
}

export function toCurrentMatchActivityItems(
  entries: readonly CurrentMatchActivityEntry[],
): readonly CurrentMatchActivityItemView[] {
  const views = entries.map(toCurrentMatchActivityEntryView);
  const viewerGroups = new Map<string, CurrentMatchActivityEntryView[]>();
  views.forEach((entry) => {
    if (entry.systemCancellationCause !== 'VIEWER_MATCHED' || !entry.systemCancellationGroupId) {
      return;
    }
    const group = viewerGroups.get(entry.systemCancellationGroupId) ?? [];
    group.push(entry);
    viewerGroups.set(entry.systemCancellationGroupId, group);
  });

  const emittedViewerGroups = new Set<string>();
  return views.flatMap((entry) => {
    if (entry.systemCancellationCause === 'COUNTERPART_MATCHED') {
      return [autoClosedGroup(`counterpart:${entry.id}`, 'COUNTERPART_MATCHED', [entry])];
    }
    if (entry.requestTerminalReason === 'WITHDRAWN_PARTICIPANT') {
      return [autoClosedGroup(`participation:${entry.id}`, 'PARTICIPATION_CANCELLED', [entry])];
    }
    if (entry.requestTerminalReason === 'MATCH_PRECONDITION_FAILED') {
      return [autoClosedGroup(`precondition:${entry.id}`, 'PRECONDITION_FAILED', [entry])];
    }
    if (entry.systemCancellationCause !== 'VIEWER_MATCHED' || !entry.systemCancellationGroupId) {
      return [{ id: entry.id, kind: 'entry', entry }];
    }
    if (emittedViewerGroups.has(entry.systemCancellationGroupId)) return [];
    emittedViewerGroups.add(entry.systemCancellationGroupId);
    return [
      autoClosedGroup(
        `viewer:${entry.systemCancellationGroupId}`,
        'VIEWER_MATCHED',
        viewerGroups.get(entry.systemCancellationGroupId) ?? [entry],
      ),
    ];
  });
}

function toCurrentMatchActivityEntryView(
  entry: CurrentMatchActivityEntry,
): CurrentMatchActivityEntryView {
  const directionLabel = entry.direction === 'SENT' ? '보낸 요청' : '받은 요청';
  return {
    id: entry.id,
    result: entry.result,
    title: activityTitle(entry),
    detail:
      entry.result === 'UNMATCHED_AFTER_SUCCESS'
        ? `매칭 해제 · ${entry.counterpartNickname}`
        : entry.result === 'MATCHED_SUCCESS'
          ? `매칭 상대 · ${entry.counterpartNickname}`
          : `${directionLabel} · ${entry.counterpartNickname}`,
    nickname: entry.counterpartNickname,
    directionLabel,
    occurredAt: entry.occurredAt,
    dateLabel: formatActivityDate(entry.occurredAt),
    systemCancellationCause: entry.systemCancellationCause,
    systemCancellationGroupId: entry.systemCancellationGroupId,
    requestTerminalReason: entry.requestTerminalReason,
  };
}

function activityTitle(entry: CurrentMatchActivityEntry) {
  if (entry.result === 'REQUEST_CANCELLED') {
    if (entry.requestTerminalReason === 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH') {
      return '요청 자동 종료';
    }
    if (
      entry.requestTerminalReason === 'WITHDRAWN_PARTICIPANT' ||
      entry.requestTerminalReason === 'MATCH_PRECONDITION_FAILED' ||
      entry.requestTerminalReason === 'ADMIN_ACTION'
    ) {
      return '요청 종료';
    }
  }

  switch (entry.result) {
    case 'REQUEST_REJECTED':
      return '요청 거절';
    case 'REQUEST_CANCELLED':
      return '요청 취소';
    case 'REQUEST_EXPIRED':
      return '요청 만료';
    case 'MATCHED_SUCCESS':
      return '매칭 완료';
    case 'UNMATCHED_AFTER_SUCCESS':
      return '매칭 후 해제';
  }
}

function autoClosedGroup(
  id: string,
  cause: Extract<CurrentMatchActivityItemView, { kind: 'auto-closed-group' }>['cause'],
  entries: readonly CurrentMatchActivityEntryView[],
): CurrentMatchActivityItemView {
  return { id, kind: 'auto-closed-group', cause, entries };
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '기록된 날짜';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(date);
}
