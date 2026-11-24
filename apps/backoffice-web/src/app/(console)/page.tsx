import Link from 'next/link';
import { requireFullSession } from '@/server/session';
import { formatKst } from '@/ui/format';
import { Section } from '@/ui/forms';
import { ROLE_LABELS } from '@/ui/labels';

export default async function HomePage() {
  const { session } = await requireFullSession();
  return (
    <>
      <h1 className="text-title-1 font-semibold text-fg-neutral">
        {session.account.displayName}님, 안녕하세요
      </h1>
      {!session.totpConfirmed || session.recoveryCodesRemaining === 0 ? (
        <p
          role="status"
          className="rounded-box bg-warning-weak px-4 py-3 text-body text-fg-warning"
        >
          passkey를 잃었을 때 쓸 복구 수단이 준비되지 않았습니다.{' '}
          <Link href="/security" prefetch={false} className="font-medium underline">
            내 보안 설정
          </Link>
          에서 TOTP를 확인하고 복구 code를 발급하세요.
        </p>
      ) : null}
      <Section id="home-session" title="이번 접속">
        <dl className="grid grid-cols-label-value gap-x-6 gap-y-2 text-body">
          <dt className="font-medium text-fg-label">역할</dt>
          <dd>
            {session.roles.length
              ? session.roles.map((role) => ROLE_LABELS[role]).join(', ')
              : '없음'}
          </dd>
          <dt className="font-medium text-fg-label">최대 접속 종료</dt>
          <dd>{formatKst(session.absoluteExpiresAt)}</dd>
          <dt className="font-medium text-fg-label">재인증 유효</dt>
          <dd>
            {session.reauthenticatedUntil
              ? `${formatKst(session.reauthenticatedUntil)}까지`
              : '없음'}
          </dd>
        </dl>
        <p className="text-caption text-fg-muted">
          15분 동안 활동이 없거나 로그인한 지 8시간이 지나면 접속이 끝납니다. 승인·권한 요청·계정
          비활성화 같은 작업은 5분 안에 passkey로 다시 확인합니다.
        </p>
      </Section>
    </>
  );
}
