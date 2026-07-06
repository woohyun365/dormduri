import { DetailRow, EmptyDetailCard } from '../sections/activity/ActivityDetailRows';
import {
  buildPublicProfileIdentityRows,
  buildPublicProfileLifestyleRows,
  resolvePublicProfileIntro,
  resolvePublicProfileTitle,
} from '../model/profile/profileDetailDisplay.mapper';
import {
  buildSeasonProfileLifestyleRows,
  buildSeasonProfileStatusRows,
  formatSeasonProfileIntro,
  type HomeProfileDisplayRow,
} from '../model/profile/seasonProfileDisplay.mapper';
import type { HomeProfileDetailState } from './useHomeProfileDetail';
import type { PublicProfile } from '@repo/shared/profile/contract';
import type {
  PreviousSeasonProfileResponse,
  SeasonProfileDraftResponse,
} from '@repo/shared/season/participation';

function DetailSkeleton({ message }: { message: string }) {
  return <EmptyDetailCard message={message} />;
}

function DetailError() {
  return (
    <EmptyDetailCard message="프로필 상세 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요." />
  );
}

function RowsGrid({ rows }: { rows: HomeProfileDisplayRow[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <DetailRow key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

export function SeasonProfileDetailContent({
  state,
  fallbackRows = [],
}: {
  state: HomeProfileDetailState<SeasonProfileDraftResponse>;
  fallbackRows?: HomeProfileDisplayRow[];
}) {
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div className="mt-4 space-y-3">
        {fallbackRows.length > 0 && <RowsGrid rows={fallbackRows} />}
        <DetailSkeleton message="시즌 프로필 상세 정보를 불러오는 중이에요." />
      </div>
    );
  }

  if (state.status !== 'success') {
    return (
      <div className="mt-4 space-y-3">
        {fallbackRows.length > 0 && <RowsGrid rows={fallbackRows} />}
        <DetailError />
      </div>
    );
  }

  const profile = state.data;
  const statusRows = buildSeasonProfileStatusRows(profile);
  const lifestyleRows = buildSeasonProfileLifestyleRows(profile);

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4">
        <p className="text-xs font-bold text-sky-700">자기소개</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {formatSeasonProfileIntro(profile)}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-(--knu-text-tertiary)">참여 상태</p>
        <RowsGrid rows={statusRows} />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-(--knu-text-tertiary)">생활패턴·룸메 조건</p>
        <RowsGrid rows={lifestyleRows} />
      </div>
    </div>
  );
}

export function PreviousSeasonProfileDetailContent({
  state,
  fallbackRows = [],
}: {
  state: HomeProfileDetailState<PreviousSeasonProfileResponse>;
  fallbackRows?: HomeProfileDisplayRow[];
}) {
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div className="space-y-3">
        {fallbackRows.length > 0 && <RowsGrid rows={fallbackRows} />}
        <DetailSkeleton message="직전 시즌 프로필 상세 정보를 불러오는 중이에요." />
      </div>
    );
  }

  if (state.status !== 'success') {
    return (
      <div className="space-y-3">
        {fallbackRows.length > 0 && <RowsGrid rows={fallbackRows} />}
        <DetailError />
      </div>
    );
  }

  const profile = state.data;
  if (profile.detailState === 'EMPTY') {
    return <EmptyDetailCard message={profile.message} />;
  }

  const seasonRows: HomeProfileDisplayRow[] = [
    { label: '참여 시즌', value: profile.seasonName },
    { label: '기숙사', value: profile.dormitoryName ?? '기숙사 정보 없음' },
  ];
  const statusRows = buildSeasonProfileStatusRows(profile);
  const lifestyleRows = buildSeasonProfileLifestyleRows(profile);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4">
        <p className="text-xs font-bold text-sky-700">나의 직전 시즌 프로필</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {formatSeasonProfileIntro(profile)}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-(--knu-text-tertiary)">시즌 정보</p>
        <RowsGrid rows={seasonRows} />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-(--knu-text-tertiary)">참여 상태</p>
        <RowsGrid rows={statusRows} />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-(--knu-text-tertiary)">생활패턴·룸메 조건</p>
        <RowsGrid rows={lifestyleRows} />
      </div>
    </div>
  );
}

export function PublicProfileDetailContent({
  state,
  fallbackNickname,
  fallbackRows = [],
}: {
  state: HomeProfileDetailState<PublicProfile>;
  fallbackNickname: string;
  fallbackRows?: HomeProfileDisplayRow[];
}) {
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div className="space-y-3">
        {fallbackRows.length > 0 && <RowsGrid rows={fallbackRows} />}
        <DetailSkeleton message="상대 프로필 상세 정보를 불러오는 중이에요." />
      </div>
    );
  }

  if (state.status !== 'success') {
    return (
      <div className="space-y-3">
        {fallbackRows.length > 0 && <RowsGrid rows={fallbackRows} />}
        <DetailError />
      </div>
    );
  }

  const profile = state.data;
  const title = resolvePublicProfileTitle(profile, fallbackNickname);
  const intro = resolvePublicProfileIntro(profile);
  const identityRows = buildPublicProfileIdentityRows(profile);
  const lifestyleRows = buildPublicProfileLifestyleRows(profile);
  const isTombstone = profile.detailState === 'TOMBSTONE';

  return (
    <div className="space-y-4">
      <div
        className={
          isTombstone
            ? 'rounded-2xl border border-slate-200 bg-slate-50 p-4'
            : 'rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4'
        }
      >
        <p className="text-xs font-bold text-indigo-700">{isTombstone ? '안내' : title}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{intro}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-(--knu-text-tertiary)">생활패턴·기본 정보</p>
        <RowsGrid rows={identityRows} />
      </div>

      {lifestyleRows.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold text-(--knu-text-tertiary)">생활패턴</p>
          <RowsGrid rows={lifestyleRows} />
        </div>
      )}
    </div>
  );
}
