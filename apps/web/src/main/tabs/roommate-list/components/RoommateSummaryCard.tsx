import {
  Bookmark,
  BookmarkCheck,
  BatteryLow,
  Bed,
  Cigarette,
  CigaretteOff,
  Lock,
  MessageCircle,
  User,
  UserRoundSearch,
  Users,
} from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import type {
  RoommateSummaryCardFactViewModel,
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
  const introPlaceholder = item.intro === '-';
  const actionStateBadges = item.actionStateBadges ?? [
    {
      label: item.actionStateLabel,
      tone: 'slate',
    } satisfies RoommateSummaryCardStatusBadgeViewModel,
  ];

  return (
    <article
      aria-labelledby={headingId}
      className="group h-full rounded-2xl border-2 border-(--knu-border) bg-white p-4 shadow-md transition-all hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor.bg} ${avatarColor.text}`}
            aria-hidden="true"
          >
            {item.nickname.charAt(0)}
          </div>
          <div className="min-w-0">
            <h2 id={headingId} className="truncate text-sm font-bold text-(--knu-text-primary)">
              {item.nickname}
            </h2>
            <p className="text-xs text-(--knu-text-tertiary)">{metadataLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.scoreLabel ? (
            <span
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${getScoreBadgeClassName(
                item.scoreLabel,
              )}`}
              aria-label={item.scoreLabel}
            >
              {item.scoreLabel}
            </span>
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
        </div>
      </div>

      {item.facts.length > 0 ? (
        <>
          <dl className="sr-only">
            {item.facts.map((fact) => (
              <div key={`${item.id}-${fact.label}`}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mb-3 flex flex-wrap gap-1.5" aria-hidden="true">
            {item.facts.map((fact) => (
              <RoommateSummaryFactChip key={`${item.id}-${fact.label}-chip`} fact={fact} />
            ))}
          </div>
        </>
      ) : null}

      <div
        className={`mb-3 flex items-start gap-1.5 rounded-xl px-3 py-2 ${
          introPlaceholder ? 'bg-slate-50' : 'bg-blue-50'
        }`}
      >
        <MessageCircle
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
            introPlaceholder ? 'text-slate-400' : 'text-blue-500'
          }`}
          aria-hidden="true"
        />
        <p
          className={`line-clamp-2 text-xs font-medium leading-relaxed ${
            introPlaceholder ? 'text-slate-500' : 'text-blue-700'
          }`}
        >
          <span className="sr-only">자기소개: </span>
          {item.intro}
        </p>
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
        <div className="grid gap-2 sm:grid-cols-2">
          {chatAction ? (
            <button
              type="button"
              aria-label={chatAction.accessibilityLabel}
              onClick={() => onStartChat?.(item)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-(--knu-primary-hover)"
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
        </div>
      ) : null}

      {item.bookmarkAction ? <p className="sr-only">{item.bookmarkAction.label}</p> : null}
    </article>
  );
}

function RoommateSummaryFactChip({ fact }: { readonly fact: RoommateSummaryCardFactViewModel }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm">
      <RoommateSummaryFactIcon fact={fact} />
      {fact.value}
    </span>
  );
}

function RoommateSummaryFactIcon({ fact }: { readonly fact: RoommateSummaryCardFactViewModel }) {
  const className = `h-3.5 w-3.5 ${getFactIconClassName(fact)}`;
  if (fact.value === '비공개') return <Lock className={className} aria-hidden />;
  if (fact.label === '흡연 여부') {
    if (fact.value === '전자담배') return <BatteryLow className={className} aria-hidden />;
    return fact.value === '비흡연' ? (
      <CigaretteOff className={className} aria-hidden />
    ) : (
      <Cigarette className={className} aria-hidden />
    );
  }
  if (fact.label === '잠버릇') return <Bed className={className} aria-hidden />;
  if (fact.label === '관계') {
    return fact.value === '친하게 지내요' ? (
      <Users className={className} aria-hidden />
    ) : (
      <User className={className} aria-hidden />
    );
  }
  return <Users className={className} aria-hidden />;
}

function getScoreBadgeClassName(scoreLabel: string): string {
  const score = Number(scoreLabel.match(/\d+/u)?.[0]);
  if (!Number.isFinite(score)) return 'border border-amber-200 bg-amber-50 text-amber-700';
  return getMatchScoreColor(score);
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
function getFactIconClassName(fact: RoommateSummaryCardFactViewModel): string {
  if (fact.value === '비공개') {
    return 'text-slate-400';
  }

  const tones: Record<string, string> = {
    '흡연 여부':
      fact.value === '비흡연'
        ? 'text-slate-500'
        : fact.value === '전자담배'
          ? 'text-rose-300'
          : 'text-rose-400',
    잠버릇: fact.value === '잠버릇 있음' ? 'text-amber-400' : 'text-slate-500',
    관계: 'text-slate-500',
  };
  return tones[fact.label] ?? 'text-slate-500';
}
