import { History, RefreshCw } from 'lucide-react';
import { ProfileHeroSection } from './ProfileHeroSection';
import { ProfileCompatibilitySection } from './ProfileCompatibilitySection';
import { ActionSummary, type PendingMatchRequestDirectActions } from './ProfileActionSummary';
import type { RoommateActionTargetSnapshot } from '../../hooks/useRoommateActions';
import type { RoommatePendingMatchRequestViewModel } from '../../model/search/roommateSearchViewModel';
import type {
  PublicProfileActionCapabilities,
  PublicProfileFullDetail,
  PublicProfileTombstone,
} from '@repo/shared/profile/contract';

export function FullDetailContent({
  profile,
  actionCapabilities,
  historicalProfileLabel,
  showActionSummary,
  pendingMatchRequest,
  dormitoryLabel,
  actionPendingTargetIds,
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
  onOpenMatchingRequests,
  pendingRequestActions,
}: {
  readonly profile: PublicProfileFullDetail;
  readonly actionCapabilities: PublicProfileActionCapabilities;
  readonly historicalProfileLabel?: string;
  readonly showActionSummary: boolean;
  readonly pendingMatchRequest: RoommatePendingMatchRequestViewModel | null;
  readonly dormitoryLabel: string | null;
  readonly actionPendingTargetIds: readonly string[];
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
  readonly onOpenMatchingRequests?: () => void;
  readonly pendingRequestActions?: PendingMatchRequestDirectActions;
}) {
  const pastHistory = profile.resultRead.context === 'PAST_MATCH_HISTORY';

  return (
    <div className="space-y-5">
      {pastHistory ? (
        <PastMatchSnapshot profile={profile} historicalProfileLabel={historicalProfileLabel} />
      ) : null}
      <ProfileHeroSection profile={profile} dormitoryLabel={dormitoryLabel} />
      {!pastHistory || profile.compatibility ? (
        <ProfileCompatibilitySection compatibility={profile.compatibility} />
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-700">세부 적합도 기록은 제공되지 않아요.</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            당시 저장된 결과만 표시하며 현재 프로필로 다시 계산하지 않아요.
          </p>
        </section>
      )}
      {showActionSummary ? (
        <ActionSummary
          target={{
            targetUserId: profile.id,
            nickname: profile.nickname,
            actions: actionCapabilities,
          }}
          pendingMatchRequest={pendingMatchRequest}
          pending={actionPendingTargetIds.includes(profile.id)}
          onRequestMatch={onRequestMatch}
          onBlock={onBlock}
          onReport={onReport}
          onStartChat={onStartChat}
          onOpenMatchingRequests={onOpenMatchingRequests}
          pendingRequestActions={pendingRequestActions}
        />
      ) : null}
    </div>
  );
}

export function TombstoneDetailContent({
  profile,
  onRefreshList,
}: {
  readonly profile: PublicProfileTombstone;
  readonly onRefreshList?: () => void;
}) {
  const pastHistory =
    profile.resultRead.context === 'PAST_MATCH_HISTORY' && onRefreshList === undefined;
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center">
      <p className="text-xs font-bold text-amber-700">예외 안내</p>
      <h2 className="mt-2 text-lg font-bold text-amber-950">
        {pastHistory ? '과거 상대 프로필을 확인할 수 없어요.' : '상대가 시즌 참여를 철회했어요.'}
      </h2>
      <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">
        {profile.tombstone.message}
      </p>
      {onRefreshList ? (
        <>
          <p className="mt-2 text-xs leading-5 text-amber-800">
            목록을 새로고침해 현재 참여 중인 후보만 다시 확인해 주세요.
          </p>
          <button
            type="button"
            onClick={onRefreshList}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            목록 새로고침
          </button>
        </>
      ) : null}
    </section>
  );
}

function PastMatchSnapshot({
  profile,
  historicalProfileLabel,
}: {
  readonly profile: PublicProfileFullDetail;
  readonly historicalProfileLabel?: string;
}) {
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-100/80 p-4 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm">
        <History className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-violet-800">저장된 매칭 결과</p>
        {typeof profile.matchScore === 'number' ? (
          <p className="mt-0.5 text-base font-black text-slate-900">
            매칭도 {profile.matchScore}점
          </p>
        ) : (
          <p className="mt-0.5 text-sm font-bold text-slate-700">저장된 매칭도 없음</p>
        )}
        <p className="mt-1 text-xs font-medium leading-5 text-violet-900">
          {historicalProfileLabel ?? '이전 시즌'} 프로필 기준이에요.
        </p>
      </div>
    </section>
  );
}
