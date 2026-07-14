import { RefreshCw } from 'lucide-react';
import { ProfileHeroSection } from './ProfileHeroSection';
import { ProfileCompatibilitySection } from './ProfileCompatibilitySection';
import { ActionSummary } from './ProfileActionSummary';
import type { RoommateActionTargetSnapshot } from '../../hooks/useRoommateActions';
import type { RoommatePendingMatchRequestViewModel } from '../../model/search/roommateSearchViewModel';
import type {
  PublicProfileFullDetail,
  PublicProfileTombstone,
} from '@repo/shared/profile/contract';

export function FullDetailContent({
  profile,
  pendingMatchRequest,
  dormitoryLabel,
  actionPendingTargetIds,
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
  onOpenMatchingRequests,
}: {
  readonly profile: PublicProfileFullDetail;
  readonly pendingMatchRequest: RoommatePendingMatchRequestViewModel | null;
  readonly dormitoryLabel: string | null;
  readonly actionPendingTargetIds: readonly string[];
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
  readonly onOpenMatchingRequests?: () => void;
}) {
  return (
    <div className="space-y-5">
      <ProfileHeroSection profile={profile} dormitoryLabel={dormitoryLabel} />
      <ProfileCompatibilitySection compatibility={profile.compatibility} />
      <ActionSummary
        target={{ targetUserId: profile.id, nickname: profile.nickname, actions: profile.actions }}
        pendingMatchRequest={pendingMatchRequest}
        pending={actionPendingTargetIds.includes(profile.id)}
        onRequestMatch={onRequestMatch}
        onBlock={onBlock}
        onReport={onReport}
        onStartChat={onStartChat}
        onOpenMatchingRequests={onOpenMatchingRequests}
      />
    </div>
  );
}

export function TombstoneDetailContent({
  profile,
  onRefreshList,
}: {
  readonly profile: PublicProfileTombstone;
  readonly onRefreshList: () => void;
}) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center">
      <p className="text-xs font-bold text-amber-700">예외 안내</p>
      <h2 className="mt-2 text-lg font-bold text-amber-950">상대가 시즌 참여를 철회했어요.</h2>
      <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">
        {profile.tombstone.message}
      </p>
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
    </section>
  );
}
