import type { ReactNode } from 'react';

interface ProfileSummaryIdentityProps {
  readonly headingId?: string;
  readonly nickname: string;
  readonly metadataLabel: string;
  readonly avatarClassName: string;
  readonly marker?: ReactNode;
  readonly trailing?: ReactNode;
}

export function ProfileSummaryIdentity({
  headingId,
  nickname,
  metadataLabel,
  avatarClassName,
  marker,
  trailing,
}: ProfileSummaryIdentityProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarClassName}`}
          aria-hidden="true"
        >
          {nickname.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 id={headingId} className="truncate text-sm font-bold text-(--knu-text-primary)">
              {nickname}
            </h2>
            {marker}
          </div>
          <p className="truncate text-xs text-(--knu-text-tertiary)">{metadataLabel}</p>
        </div>
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
