import type { ReactNode } from 'react';
import { Building2, CalendarDays, IdCard, UserRound } from 'lucide-react';
import type { PreviousSeasonProfileFull } from '@repo/shared/season/participation';
import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import type { MatchHistorySelfProfileState } from '../../hooks/useMatchHistorySelfProfile';
import {
  buildHistorySelfProfileIdentityRows,
  buildHistorySelfProfileLifestyleRows,
  buildHistorySelfProfilePreferenceRows,
  formatHistorySelfProfileIntro,
  formatHistorySelfProfileSnapshotDate,
  type HistorySelfProfileRow,
} from '../../model/history-self-profile-view';

export function HistorySelfProfileDialog({
  state,
  onClose,
  onRetry,
}: {
  readonly state: MatchHistorySelfProfileState;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}) {
  return (
    <BaseBottomSheet isOpen={state.status !== 'closed'} onClose={onClose} title="해당 시즌 프로필">
      <div className="space-y-5 px-5 py-5">
        {state.status === 'loading' ? (
          <DialogNotice
            icon={<UserRound className="h-6 w-6" aria-hidden />}
            title={`${state.target.seasonName} 프로필을 불러오는 중이에요`}
            description="시즌 등록 당시 저장된 정보를 확인하고 있어요."
          />
        ) : null}
        {state.status === 'error' ? (
          <DialogNotice
            icon={<UserRound className="h-6 w-6" aria-hidden />}
            title="해당 시즌 프로필을 불러오지 못했어요"
            description="잠시 후 다시 시도해주세요."
            action={<RetryButton onRetry={onRetry} />}
          />
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'EMPTY' ? (
          <DialogNotice
            icon={<UserRound className="h-6 w-6" aria-hidden />}
            title="확인할 수 있는 프로필이 없어요"
            description={state.profile.message}
          />
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'FULL' ? (
          <HistorySelfProfileContent profile={state.profile} />
        ) : null}
      </div>
    </BaseBottomSheet>
  );
}

function HistorySelfProfileContent({ profile }: { readonly profile: PreviousSeasonProfileFull }) {
  const identityRows = buildHistorySelfProfileIdentityRows(profile);
  const lifestyleRows = buildHistorySelfProfileLifestyleRows(profile);
  const preferenceRows = buildHistorySelfProfilePreferenceRows(profile);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm">
            <UserRound className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-blue-700">그 시즌의 나</p>
            <h2 className="mt-1 truncate text-lg font-black text-(--knu-text-primary)">
              {profile.seasonName}
            </h2>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <ProfileFact
            icon={<Building2 className="h-4 w-4" aria-hidden />}
            label="기숙사"
            value={profile.dormitoryName ?? '기숙사 정보 없음'}
          />
          <ProfileFact
            icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            label="프로필 저장"
            value={formatHistorySelfProfileSnapshotDate(profile.profileSnapshotAt)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <p className="text-xs font-bold text-sky-700">자기소개</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {formatHistorySelfProfileIntro(profile)}
        </p>
      </section>

      <ProfileRows title="기본 정보" rows={identityRows} />
      <ProfileRows title="생활패턴" rows={lifestyleRows} />
      <ProfileRows title="원하는 룸메 조건" rows={preferenceRows} />
    </div>
  );
}

function ProfileFact({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white bg-white px-3 py-2 shadow-sm">
      <span className="text-blue-600">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-(--knu-text-tertiary)">{label}</span>
        <span className="block truncate text-sm font-bold text-(--knu-text-primary)">{value}</span>
      </span>
    </div>
  );
}

function ProfileRows({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly HistorySelfProfileRow[];
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <IdCard className="h-4 w-4 text-indigo-600" aria-hidden />
        <h3 className="text-sm font-bold text-(--knu-text-primary)">{title}</h3>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs font-medium text-(--knu-text-tertiary)">{row.label}</dt>
            <dd className="mt-1 text-sm font-bold text-(--knu-text-primary)">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DialogNotice({
  icon,
  title,
  description,
  action,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <section
      role="status"
      className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
        {icon}
      </span>
      <h2 className="mt-4 text-base font-bold text-(--knu-text-primary)">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">{description}</p>
      {action}
    </section>
  );
}

function RetryButton({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="mt-4 min-h-11 rounded-xl bg-(--knu-primary) px-4 text-sm font-semibold text-white"
    >
      다시 시도
    </button>
  );
}
