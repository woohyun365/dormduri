import { motion } from 'motion/react';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Flag,
  Handshake,
  MessageCircle,
  RotateCcw,
  Settings2,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { getAvatarColor } from '@/main/components/avatar/avatarPresentation';
import { getMatchScoreColor } from '@/profile-summary/model/matchScorePresentation';
import type { MatchingActiveView } from '../../model/matching-active-view';
import { UnmatchProgress } from '../UnmatchProgress';

export function PairActiveMatchCard({
  activeMatch,
  readOnly,
  pending = false,
  roomSelectionDate,
  seasonEndDate,
  onOpenProfile,
  onNavigateChat,
  onUnmatchDecision,
}: {
  readonly activeMatch: MatchingActiveView;
  readonly readOnly: boolean;
  readonly pending?: boolean;
  readonly roomSelectionDate?: string | null;
  readonly seasonEndDate?: string | null;
  readonly onOpenProfile?: (trigger: HTMLButtonElement) => void;
  readonly onNavigateChat?: () => void;
  readonly onUnmatchDecision?: (trigger: HTMLButtonElement) => void;
}) {
  const avatarColor = getAvatarColor(activeMatch.nickname);
  const hasPendingUnmatchRequest =
    activeMatch.unmatch.state === 'WAITING_FOR_ME' ||
    activeMatch.unmatch.state === 'WAITING_FOR_COUNTERPART';
  const waitingForMe = activeMatch.unmatch.state === 'WAITING_FOR_ME';
  const showManagement =
    !readOnly && activeMatch.unmatch.disabledReason !== 'ROOM_SELECTION_CUTOFF';
  const [managementExpanded, setManagementExpanded] = useState(hasPendingUnmatchRequest);
  const showManagementContent = managementExpanded;
  const managementId = `matching-management-${activeMatch.id}`;
  const cardTone = waitingForMe ? 'attention' : hasPendingUnmatchRequest ? 'pending' : 'success';
  const cardBorderClass = waitingForMe
    ? 'border-violet-200 ring-1 ring-violet-100'
    : hasPendingUnmatchRequest
      ? 'border-sky-200 ring-1 ring-sky-100'
      : 'border-emerald-200';

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      aria-busy={pending || undefined}
      data-testid="matching-active-summary-card"
      data-tone={cardTone}
      data-design-source="legacy-pair"
      className={`relative overflow-hidden rounded-3xl border bg-white shadow-sm ${cardBorderClass}`}
    >
      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
            <Handshake className="h-3.5 w-3.5" aria-hidden />
            {readOnly ? '이번 시즌 매칭 결과' : '매칭 확정'}
          </span>
          {activeMatch.scoreState === 'visible' && activeMatch.score !== null ? (
            <span
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${getMatchScoreColor(activeMatch.score)}`}
            >
              매칭 {activeMatch.score}%
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex min-w-0 items-center gap-3">
          <div
            aria-hidden
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ring-4 ring-white ${avatarColor.bg} ${avatarColor.text}`}
          >
            {activeMatch.nickname.trim().charAt(0) || '룸'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500">함께 지낼 룸메이트</p>
            <h3 className="mt-0.5 wrap-break-word text-xl font-black text-(--knu-text-primary)">
              {activeMatch.nickname}
            </h3>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <MatchScheduleSummary
          matchedAt={activeMatch.startedAt}
          roomSelectionDate={roomSelectionDate}
          seasonEndDate={seasonEndDate}
        />

        <div className="grid gap-2">
          {activeMatch.canStartChat && onNavigateChat ? (
            <button
              type="button"
              aria-label="채팅하기"
              className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
              onClick={onNavigateChat}
            >
              <span className="flex items-center justify-center gap-2">
                <MessageCircle className="h-4 w-4" aria-hidden /> 채팅하기
              </span>
            </button>
          ) : null}

          {activeMatch.canOpenProfile && onOpenProfile ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-(--knu-primary) transition-colors hover:border-blue-200 hover:bg-blue-50"
              onClick={(event) => onOpenProfile(event.currentTarget)}
            >
              <span className="flex items-center justify-center gap-2">
                <UserRound className="h-4 w-4" aria-hidden />
                <span aria-hidden>상대 프로필</span>
                <span className="sr-only">{activeMatch.nickname} 프로필 상세 보기</span>
              </span>
            </motion.button>
          ) : null}
        </div>

        {!readOnly ? (
          <p className="flex items-start gap-2 rounded-2xl bg-sky-50/70 px-3 py-2.5 text-xs leading-5 text-sky-800">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            실제 호실 선택은 학교 공식 일정에 맞춰 학교 홈페이지에서 진행해요.
          </p>
        ) : null}

        {showManagement ? (
          <section
            className={`overflow-hidden rounded-2xl border transition-colors ${
              waitingForMe
                ? 'border-violet-200 bg-violet-50/70'
                : hasPendingUnmatchRequest
                  ? 'border-sky-200 bg-sky-50/70'
                  : 'border-slate-200 bg-slate-50/60'
            }`}
            aria-labelledby="matching-management-heading"
          >
            <button
              type="button"
              aria-expanded={showManagementContent}
              aria-controls={managementId}
              onClick={() => setManagementExpanded((current) => !current)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors ${
                waitingForMe
                  ? 'hover:bg-violet-100/70'
                  : hasPendingUnmatchRequest
                    ? 'hover:bg-sky-100/70'
                    : 'hover:bg-slate-100/70'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    waitingForMe
                      ? 'bg-violet-100 text-violet-700'
                      : hasPendingUnmatchRequest
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {hasPendingUnmatchRequest ? (
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  ) : (
                    <Settings2 className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    id="matching-management-heading"
                    className={`block text-sm font-bold ${
                      waitingForMe
                        ? 'text-violet-900'
                        : hasPendingUnmatchRequest
                          ? 'text-sky-900'
                          : 'text-slate-700'
                    }`}
                  >
                    매칭 관리
                  </span>
                  <span
                    className={`block text-xs leading-5 ${
                      waitingForMe
                        ? 'text-violet-700'
                        : hasPendingUnmatchRequest
                          ? 'text-sky-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {waitingForMe
                      ? '대화 후 해제 여부를 결정해요.'
                      : hasPendingUnmatchRequest
                        ? '상대에게 해제 동의를 구해요.'
                        : '필요한 경우 매칭을 해제해요.'}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {hasPendingUnmatchRequest ? (
                  <span
                    className={`hidden rounded-full px-2 py-1 text-[10px] font-bold min-[361px]:inline-flex ${
                      waitingForMe
                        ? 'bg-violet-600 text-white'
                        : 'bg-white text-sky-700 ring-1 ring-sky-200'
                    }`}
                  >
                    {waitingForMe ? '내 응답 필요' : '응답 대기'}
                  </span>
                ) : null}
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${
                    showManagementContent ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </span>
            </button>

            {showManagementContent ? (
              <div
                id={managementId}
                className={`space-y-3 border-t px-3 pb-3 pt-3 ${
                  waitingForMe
                    ? 'border-violet-200'
                    : hasPendingUnmatchRequest
                      ? 'border-sky-200'
                      : 'border-slate-200'
                }`}
              >
                {activeMatch.unmatch.state !== 'NONE' ? (
                  <UnmatchProgress progress={activeMatch.unmatch} />
                ) : (
                  <div className="px-1 py-1">
                    <p className="text-xs font-bold text-slate-700">
                      매칭 해제는 두 사람의 동의가 필요해요.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      상대가 동의하기 전까지 매칭은 유지돼요.
                    </p>
                  </div>
                )}

                {activeMatch.unmatch.primaryAction && onUnmatchDecision ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.99 }}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      activeMatch.unmatch.state === 'WAITING_FOR_ME'
                        ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    disabled={pending}
                    aria-describedby={activeMatch.unmatch.disabledReasonDescriptionId ?? undefined}
                    onClick={(event) => onUnmatchDecision(event.currentTarget)}
                  >
                    {pending ? '처리 중…' : activeMatch.unmatch.primaryActionLabel}
                  </motion.button>
                ) : null}

                {activeMatch.unmatch.disabledReasonCopy &&
                activeMatch.unmatch.disabledReasonDescriptionId ? (
                  <p
                    id={activeMatch.unmatch.disabledReasonDescriptionId}
                    className="px-1 text-xs leading-5 text-slate-500"
                  >
                    {activeMatch.unmatch.disabledReasonCopy}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {pending ? (
          <p role="status" className="mt-3 text-xs text-(--knu-text-tertiary)">
            요청을 처리하고 있어요.
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}

function MatchScheduleSummary({
  matchedAt,
  roomSelectionDate,
  seasonEndDate,
}: {
  readonly matchedAt: string;
  readonly roomSelectionDate?: string | null;
  readonly seasonEndDate?: string | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-4">
      <ol
        aria-label="매칭 일정"
        className="relative grid grid-cols-3 before:absolute before:left-[calc(16.666%+1.25rem)] before:right-[calc(16.666%+1.25rem)] before:top-5 before:h-0.5 before:bg-linear-to-r before:from-sky-200 before:via-emerald-200 before:to-violet-200 before:content-['']"
      >
        <li className="relative z-10 min-w-0 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 border-slate-50 bg-sky-100 text-sky-700">
            <CalendarDays className="h-4 w-4" aria-hidden />
          </span>
          <span className="mt-2 block text-[11px] font-bold text-slate-500">매칭일</span>
          <time className="mx-auto mt-0.5 block max-w-24 break-keep text-[11px] font-black leading-4 text-slate-800 sm:max-w-none">
            {formatCompactDate(matchedAt)}
          </time>
        </li>
        <li className="relative z-10 min-w-0 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 border-slate-50 bg-emerald-100 text-emerald-700">
            <Building2 className="h-4 w-4" aria-hidden />
          </span>
          <span className="mt-2 block break-keep text-[11px] font-bold text-emerald-700">
            매칭 종료일
          </span>
          <span className="sr-only">호실 선택일</span>
          <span className="mx-auto mt-0.5 block max-w-24 break-keep text-[11px] font-black leading-4 text-emerald-900 sm:max-w-none">
            {roomSelectionDate ? formatCompactDate(roomSelectionDate) : '일정 확인'}
          </span>
        </li>
        <li className="relative z-10 min-w-0 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 border-slate-50 bg-violet-100 text-violet-700">
            <Flag className="h-4 w-4" aria-hidden />
          </span>
          <span className="mt-2 block break-keep text-[11px] font-bold text-violet-700">
            시즌 종료일
          </span>
          <span className="mx-auto mt-0.5 block max-w-24 break-keep text-[11px] font-black leading-4 text-violet-900 sm:max-w-none">
            {seasonEndDate ? formatCompactDate(seasonEndDate) : '일정 확인'}
          </span>
        </li>
      </ol>
    </section>
  );
}

function formatCompactDate(value: string): string {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(normalized));
}
