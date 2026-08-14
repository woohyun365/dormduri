import type { ReactNode } from 'react';
import {
  CalendarDays,
  Check,
  Clock,
  MessageCircle,
  Send,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { CounterpartActionFooter, CounterpartCardShell } from '@/main/components/counterpart-card';
import { getAvatarColor } from '@/main/components/avatar/avatarPresentation';
import { getMatchScoreColor } from '@/profile-summary/model/matchScorePresentation';
import type { MatchingRequestCardView } from '../../model/matching-request-view';
import type { MatchRequestDecision } from '../../overlays/MatchRequestDecisionDialog';
import { RequestExpiryText } from '../RequestExpiryText';
import { PairRequestNotePanel } from './PairRequestNotePanel';

export function PairRequestCard({
  request,
  serverNow,
  roomSelectionDate,
  pending,
  onDecision,
  onOpenProfile,
}: {
  readonly request: MatchingRequestCardView;
  readonly serverNow: string;
  readonly roomSelectionDate: string | null;
  readonly pending: boolean;
  readonly onDecision: (decision: MatchRequestDecision, trigger: HTMLButtonElement) => void;
  readonly onOpenProfile?: (request: MatchingRequestCardView, trigger: HTMLButtonElement) => void;
}) {
  const terminal = request.presentation === 'terminal';
  const received = request.direction === 'RECEIVED';
  const directionLabel = received ? '받은 요청' : '보낸 요청';
  const primaryDecision = received ? request.actions.accept : request.actions.cancel;
  const avatarColor = getAvatarColor(request.nickname);
  const headingId = `matching-request-${request.id}`;
  const hasActiveChatThread = request.hasActiveChatThread === true;
  const actionClass =
    'flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';

  return (
    <CounterpartCardShell
      labelledBy={headingId}
      tone={terminal ? 'terminal' : received ? 'received' : 'sent'}
      animated
      busy={pending}
      testId="matching-request-card"
      designSource="legacy-pair"
      className="relative min-w-0 overflow-visible hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            aria-hidden
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ring-white ${avatarColor.bg} ${avatarColor.text}`}
          >
            {request.nickname.trim().charAt(0) || '상'}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[11px] font-bold ${
                terminal ? 'text-slate-500' : received ? 'text-violet-700' : 'text-sky-700'
              }`}
            >
              {directionLabel} · {request.statusLabel}
            </p>
            <h3
              id={headingId}
              className="mt-1 wrap-break-word text-base font-black leading-tight text-(--knu-text-primary)"
            >
              {request.nickname}
            </h3>
          </div>
        </div>
        {request.score !== null ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${getMatchScoreColor(request.score)}`}
          >
            매칭 {request.score}%
          </span>
        ) : (
          <span className="max-w-24 shrink-0 text-right text-[10px] leading-4 text-(--knu-text-tertiary)">
            {request.scoreHiddenCopy}
          </span>
        )}
      </div>

      <div className="mt-3">
        <PairRequestNotePanel direction={request.direction} note={request.note} />
      </div>

      <dl
        aria-label="요청 정보"
        className={`mt-3 grid gap-2 ${terminal ? 'grid-cols-2' : 'grid-cols-3'}`}
      >
        <RequestMetadataItem
          icon={CalendarDays}
          label={received ? '요청 도착' : '요청 전송'}
          value={formatRequestDate(request.createdAt)}
          tone="sky"
        />
        <RequestMetadataItem
          icon={MessageCircle}
          label="대화 상태"
          value={hasActiveChatThread ? '대화 중' : request.canStartChat ? '대화 전' : '이용 불가'}
          tone={hasActiveChatThread ? 'teal' : 'slate'}
        />
        {!terminal ? (
          <RequestMetadataItem icon={Clock} label="응답 기한" tone="slate">
            <RequestExpiryText
              compact
              serverNow={serverNow}
              expiresAt={request.expiresAt}
              roomSelectionDate={roomSelectionDate}
            />
          </RequestMetadataItem>
        ) : null}
      </dl>

      {primaryDecision.reasonCopy ? (
        <p
          id={primaryDecision.reasonDescriptionId ?? undefined}
          className="wrap-break-word mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
        >
          {primaryDecision.reasonCopy}
        </p>
      ) : null}

      <CounterpartActionFooter
        testId="matching-request-direct-actions"
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        <div className="flex min-w-0 flex-wrap gap-2">
          {request.detailEntryToken && onOpenProfile ? (
            <button
              type="button"
              className={`${actionClass} flex-1 border border-(--knu-border) bg-white text-(--knu-text-primary) hover:border-slate-300 hover:bg-slate-50 sm:flex-none`}
              onClick={(event) => onOpenProfile(request, event.currentTarget)}
            >
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              <span aria-hidden>프로필</span>
              <span className="sr-only">{request.nickname} 프로필 상세 보기</span>
            </button>
          ) : null}
        </div>

        {!terminal && !received ? (
          <button
            type="button"
            className={`${actionClass} w-full border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100 sm:w-auto`}
            disabled={pending || !request.actions.cancel.allowed}
            aria-describedby={request.actions.cancel.reasonDescriptionId ?? undefined}
            onClick={(event) => onDecision('cancel', event.currentTarget)}
          >
            <Send className="h-3.5 w-3.5" aria-hidden /> 요청 취소
          </button>
        ) : null}
        {!terminal && received ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`${actionClass} border border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-200`}
              disabled={pending || !request.actions.reject.allowed}
              aria-describedby={request.actions.reject.reasonDescriptionId ?? undefined}
              onClick={(event) => onDecision('reject', event.currentTarget)}
            >
              <X className="h-3.5 w-3.5" aria-hidden /> 거절
            </button>
            <button
              type="button"
              className={`${actionClass} bg-(--knu-primary) text-white hover:bg-blue-700`}
              disabled={pending || !request.actions.accept.allowed}
              aria-describedby={request.actions.accept.reasonDescriptionId ?? undefined}
              onClick={(event) => onDecision('accept', event.currentTarget)}
            >
              <Check className="h-3.5 w-3.5" aria-hidden /> 수락
            </button>
          </div>
        ) : null}
      </CounterpartActionFooter>
      {pending ? (
        <p role="status" className="mt-2 text-xs text-(--knu-text-tertiary)">
          요청을 처리하고 있어요.
        </p>
      ) : null}
    </CounterpartCardShell>
  );
}

const REQUEST_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

function formatRequestDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : REQUEST_DATE_FORMATTER.format(date);
}

function RequestMetadataItem({
  icon: Icon,
  label,
  value,
  tone,
  children,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value?: string;
  readonly tone: 'sky' | 'teal' | 'slate';
  readonly children?: ReactNode;
}) {
  const iconTone = {
    sky: 'bg-sky-100 text-sky-600',
    teal: 'bg-teal-100 text-teal-600',
    slate: 'bg-slate-200 text-slate-600',
  }[tone];

  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2.5 text-center">
      <span
        className={`mx-auto grid h-6 w-6 place-items-center rounded-full ${iconTone}`}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <dt className="mt-1.5 text-[10px] font-bold text-slate-500">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-xs font-bold leading-5 text-slate-700">
        {children ?? value}
      </dd>
    </div>
  );
}
