import type { ComponentProps, ReactNode } from 'react';
import type { SessionInfoResponse } from '@repo/shared/backoffice';
import { Card } from '@/ui/Card';
import { formatKstShort } from '@/ui/format';
import { Icon } from '@/ui/icons';
import { ROLE_LABELS } from '@/ui/labels';
import { StatusBadge } from '@/ui/status';
import { TextLink } from '@/ui/TextLink';

/**
 * The first page of pending access requests the home page read: null without `admin:access:approve`, `unavailable`
 * when the read was refused or could not be used.
 */
export type PendingRequests =
  { readonly count: number; readonly overflow: boolean } | 'unavailable' | null;

const SESSION_RULE =
  '15분 동안 활동이 없거나 로그인한 지 8시간이 지나면 접속이 끝납니다. 승인·권한 요청·계정 비활성화 같은 작업은 5분 안에 passkey로 다시 확인합니다.';

function CardLink({
  href,
  children,
}: {
  readonly href: ComponentProps<typeof TextLink>['href'];
  readonly children: ReactNode;
}) {
  return (
    <TextLink href={href} className="inline-flex items-center gap-1 text-body">
      {children}
      <Icon name="arrow" className="size-4" />
    </TextLink>
  );
}

function SessionList({ session }: { readonly session: SessionInfoResponse }) {
  const rows: readonly [string, string][] = [
    [
      '역할',
      session.roles.length ? session.roles.map((role) => ROLE_LABELS[role]).join(', ') : '없음',
    ],
    // A dashboard card reads the short form (design guide ⑦; a detail keeps seconds).
    ['최대 접속 종료', `${formatKstShort(session.absoluteExpiresAt)} KST`],
    [
      '재인증 유효',
      session.reauthenticatedUntil
        ? `${formatKstShort(session.reauthenticatedUntil)} KST까지`
        : '없음',
    ],
  ];
  return (
    // Label above value: the card is a third of the body, too narrow for a label column beside a time.
    <dl className="flex flex-col gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-caption font-semibold text-fg-muted">{label}</dt>
          <dd className="text-body text-fg-neutral tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecoveryList({ session }: { readonly session: SessionInfoResponse }) {
  return (
    <ul className="flex flex-col gap-2.5">
      <li className="flex items-center justify-between gap-3">
        <span className="text-body text-fg-label">TOTP</span>
        {session.totpConfirmed ? (
          <StatusBadge meaning="success">확인함</StatusBadge>
        ) : (
          <StatusBadge meaning="warning">확인 안 함</StatusBadge>
        )}
      </li>
      <li className="flex items-center justify-between gap-3">
        <span className="text-body text-fg-label">남은 복구 code</span>
        {session.recoveryCodesRemaining > 0 ? (
          <StatusBadge meaning="success">{session.recoveryCodesRemaining}개</StatusBadge>
        ) : (
          <StatusBadge meaning="warning">0개</StatusBadge>
        )}
      </li>
      <li className="flex items-center justify-between gap-3">
        <span className="text-body text-fg-label">등록한 passkey</span>
        <span className="text-body font-semibold text-fg-neutral tabular-nums">
          {session.passkeyCount}개
        </span>
      </li>
    </ul>
  );
}

/**
 * The home dashboard (design guide ④): what waits for the operator, from values the API already gives — the session,
 * its recovery means and the first page of pending access requests. No new API, no statistics. A line waits only when
 * there is something to do; otherwise the card says so in one sentence.
 */
export function HomeDashboard({
  session,
  pending,
}: {
  readonly session: SessionInfoResponse;
  readonly pending: PendingRequests;
}) {
  const recoveryMissing = !session.totpConfirmed || session.recoveryCodesRemaining === 0;
  const unread = pending === 'unavailable';
  const waiting =
    pending !== null && pending !== 'unavailable' && (pending.count > 0 || pending.overflow);
  return (
    <>
      <h1 className="text-title-1 font-bold text-fg-neutral">
        {session.account.displayName}님, 안녕하세요
      </h1>
      <div className="grid items-start gap-stack lg:grid-cols-3">
        <Card id="home-todo" title="처리할 일" className="lg:col-span-2">
          {waiting || unread || recoveryMissing ? (
            <ul className="flex flex-col divide-y divide-stroke-row">
              {unread ? (
                <li className="flex flex-wrap items-baseline gap-x-5 gap-y-2 py-4 first:pt-0 last:pb-0">
                  <span className="w-14 shrink-0">
                    <StatusBadge meaning="warning">주의</StatusBadge>
                  </span>
                  <span role="status" className="min-w-0 flex-1 text-body text-fg-label">
                    대기 권한 요청을 지금 읽지 못했습니다.
                  </span>
                  <CardLink href={{ pathname: '/access', query: { status: 'PENDING' } }}>
                    권한 요청 보기
                  </CardLink>
                </li>
              ) : null}
              {waiting ? (
                <li className="flex flex-wrap items-baseline gap-x-5 gap-y-2 py-4 first:pt-0 last:pb-0">
                  {/* The status keeps a column of its own before the line (design guide ⑥). */}
                  <span className="w-14 shrink-0">
                    <StatusBadge meaning="pending">대기</StatusBadge>
                  </span>
                  <span className="min-w-0 flex-1 text-body text-fg-label">
                    결정을 기다리는 권한 요청{' '}
                    <strong className="text-fg-neutral tabular-nums">
                      {pending.overflow ? '50건 이상' : `${pending.count}건`}
                    </strong>
                  </span>
                  <CardLink href={{ pathname: '/access', query: { status: 'PENDING' } }}>
                    권한 요청 보기
                  </CardLink>
                </li>
              ) : null}
              {recoveryMissing ? (
                <li className="flex flex-wrap items-baseline gap-x-5 gap-y-2 py-4 first:pt-0 last:pb-0">
                  <span className="w-14 shrink-0">
                    <StatusBadge meaning="warning">주의</StatusBadge>
                  </span>
                  <span role="status" className="min-w-0 flex-1 text-body text-fg-label">
                    passkey를 잃었을 때 쓸 복구 수단이 준비되지 않았습니다. TOTP를 확인하고 복구
                    code를 발급하세요.
                  </span>
                  <CardLink href="/security">내 보안 설정</CardLink>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-body text-fg-description">지금 처리할 일이 없습니다.</p>
          )}
        </Card>
        <div className="flex flex-col gap-stack">
          <Card id="home-session" title="내 접속">
            <SessionList session={session} />
            <p className="text-caption text-fg-muted">{SESSION_RULE}</p>
          </Card>
          <Card id="home-recovery" title="복구 수단">
            <RecoveryList session={session} />
          </Card>
        </div>
      </div>
    </>
  );
}
