import { Bookmark, BookmarkCheck, MessageCircle, UserRoundSearch } from 'lucide-react';
import { getAvatarColor } from '@/main/components/avatar/avatarPresentation';
import { CounterpartActionFooter, CounterpartCardShell } from '@/main/components/counterpart-card';
import {
  ProfileSummaryFactList,
  ProfileSummaryIdentity,
  ProfileSummaryIntroPanel,
  ProfileSummaryScoreBadge,
} from '@/profile-summary/components';
import type {
  RoommateSummaryCardStatusBadgeViewModel,
  RoommateSummaryCardViewModel,
} from '../model/search/roommateSearchViewModel';

interface RoommateSummaryCardDetailAction {
  readonly enabled: boolean;
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly onOpen: () => void;
}

interface RoommateSummaryCardProps {
  readonly item: RoommateSummaryCardViewModel;
  readonly detailAction?: RoommateSummaryCardDetailAction;
  readonly onBookmarkToggle?: (targetUserId: string, bookmarked: boolean) => void;
  readonly onStartChat?: (item: RoommateSummaryCardViewModel) => void;
}

export function RoommateSummaryCard({
  item,
  detailAction,
  onBookmarkToggle,
  onStartChat,
}: RoommateSummaryCardProps) {
  const headingId = `roommate-summary-${item.id}`;
  const avatarColor = getAvatarColor(item.nickname);
  const chatAction = item.chatAction;
  const metadataLabel = item.metadataLabel ?? getFallbackMetadataLabel(item);
  const profileVisibilityBadge =
    item.profileVisibilityBadge === undefined
      ? ({
          label: item.summaryOnly ? '프로필 열람 불가' : '프로필 열람 가능',
          tone: item.summaryOnly ? 'amber' : 'green',
        } satisfies RoommateSummaryCardStatusBadgeViewModel)
      : item.profileVisibilityBadge;
  const actionGridClass = chatAction && detailAction ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2';
  const actionStateBadges = item.actionStateBadges ?? [
    {
      label: item.actionStateLabel,
      tone: 'slate',
    } satisfies RoommateSummaryCardStatusBadgeViewModel,
  ];
  const score = item.scoreLabel ? Number(item.scoreLabel.match(/\d+/u)?.[0]) : null;

  return (
    <CounterpartCardShell
      labelledBy={headingId}
      tone="neutral"
      interactive
      className="h-full shadow-md"
    >
      <div className="mb-3">
        <ProfileSummaryIdentity
          headingId={headingId}
          nickname={item.nickname}
          metadataLabel={metadataLabel}
          avatarClassName={`${avatarColor.bg} ${avatarColor.text}`}
          trailing={
            <>
              {item.scoreLabel ? (
                score !== null && Number.isFinite(score) ? (
                  <ProfileSummaryScoreBadge score={score} label={item.scoreLabel} />
                ) : (
                  <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    {item.scoreLabel}
                  </span>
                )
              ) : null}
              {item.bookmarkAction ? (
                <button
                  type="button"
                  aria-label={item.bookmarkAction.accessibilityLabel}
                  title={item.bookmarkAction.label}
                  disabled={item.bookmarkAction.disabled}
                  onClick={() => onBookmarkToggle?.(item.targetUserId, item.bookmarked)}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    item.bookmarked
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-(--knu-border) bg-white text-(--knu-text-secondary) hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  {item.bookmarked ? (
                    <BookmarkCheck className="h-5 w-5 fill-current" aria-hidden />
                  ) : (
                    <Bookmark className="h-5 w-5" aria-hidden />
                  )}
                </button>
              ) : null}
            </>
          }
        />
      </div>

      <ProfileSummaryFactList ownerId={item.id} facts={item.facts} className="mb-3" />

      <div className="mb-3">
        <ProfileSummaryIntroPanel intro={item.intro} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" aria-label="룸메이트 카드 상태">
        {profileVisibilityBadge ? (
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getActionBadgeClassName(
              profileVisibilityBadge,
            )}`}
          >
            {profileVisibilityBadge.label}
          </span>
        ) : null}
        {actionStateBadges.map((badge) => (
          <span
            key={`${item.id}-${badge.label}`}
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getActionBadgeClassName(
              badge,
            )}`}
          >
            {badge.label}
          </span>
        ))}
      </div>

      {chatAction || detailAction ? (
        <CounterpartActionFooter className={actionGridClass}>
          {chatAction ? (
            <button
              type="button"
              aria-label={chatAction.accessibilityLabel}
              onClick={() => onStartChat?.(item)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition-all hover:border-teal-300 hover:bg-teal-100"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {chatAction.label}
            </button>
          ) : null}
          {detailAction ? (
            <button
              type="button"
              aria-label={detailAction.accessibilityLabel}
              disabled={!detailAction.enabled}
              onClick={detailAction.onOpen}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:bg-(--knu-background-alt) disabled:text-(--knu-text-secondary) ${
                chatAction
                  ? 'border border-(--knu-border) bg-white text-(--knu-primary) hover:border-(--knu-primary)'
                  : 'bg-(--knu-primary) text-white hover:bg-(--knu-primary-hover)'
              }`}
            >
              <UserRoundSearch className="h-4 w-4" aria-hidden />
              {detailAction.label}
            </button>
          ) : null}
        </CounterpartActionFooter>
      ) : null}

      {item.bookmarkAction ? <p className="sr-only">{item.bookmarkAction.label}</p> : null}
    </CounterpartCardShell>
  );
}

function getActionBadgeClassName(badge: RoommateSummaryCardStatusBadgeViewModel): string {
  const classes: Record<RoommateSummaryCardStatusBadgeViewModel['tone'], string> = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    teal: 'bg-teal-50 text-teal-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return classes[badge.tone];
}

function getFallbackMetadataLabel(item: RoommateSummaryCardViewModel): string {
  return item.detailViewable ? '프로필 비교 가능' : '프로필 요약만 표시';
}
