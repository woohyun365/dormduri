'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Flag,
  MoreVertical,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ReportSheet } from '@/main/components/ReportSheet';
import { getAvatarColor } from '@/utils/avatarColor';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { ReportReason } from '@/types/report';
import {
  formatChatDateDivider,
  formatChatMessageTime,
  type ChatRoomSummary,
  type ChatTimelineEntry,
} from './chatViewModel';

interface ChatRoomViewProps {
  room: ChatRoomSummary;
  seasonState: SeasonState;
  daysUntilEnd: number;
  onBack: () => void;
  onOpenProfile: () => void;
  onToggleConfirm: () => void;
  onEndConversation: () => void;
  onManageMatch: () => void;
  onBlock: () => void;
  onReport: (reason: ReportReason, detail: string | null) => void;
}

type PendingAction = 'toggle-confirm' | 'end-conversation' | 'manage-match' | 'block' | null;

function formatExactDateTime(value: string): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${formatChatMessageTime(value)}`;
}

function RoomAvatar({ room }: { room: ChatRoomSummary }) {
  const color = getAvatarColor(room.title);
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${color.bg} ${color.text}`}
    >
      {room.title.charAt(0)}
    </div>
  );
}

function HeaderActionButton({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: typeof ChevronRight;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors ${
        tone === 'danger'
          ? 'text-red-600 hover:bg-red-50'
          : 'text-[var(--knu-text-primary)] hover:bg-[var(--knu-background-alt)]'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function PolicyCard({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: typeof ShieldAlert;
  tone: 'info' | 'warning' | 'neutral';
  title: string;
  description: string;
}) {
  const className =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'neutral'
        ? 'border-slate-200 bg-white text-[var(--knu-text-primary)]'
        : 'border-blue-200 bg-blue-50 text-blue-900';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed opacity-90 whitespace-pre-line">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function SystemEntry({ entry }: { entry: ChatTimelineEntry }) {
  return (
    <div className="flex justify-center py-1">
      <div className="max-w-[85%] rounded-full bg-slate-200 px-3 py-1.5 text-center text-xs font-medium text-slate-700">
        {entry.text}
      </div>
    </div>
  );
}

function MessageEntry({ entry }: { entry: ChatTimelineEntry }) {
  return (
    <div className={`flex ${entry.isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 ${
          entry.isMine
            ? 'rounded-br-sm bg-[var(--knu-primary)] text-white'
            : 'rounded-bl-sm border border-[var(--knu-border)] bg-white text-[var(--knu-text-primary)]'
        }`}
      >
        <p className="text-sm leading-relaxed">{entry.text}</p>
        <p
          className={`mt-1 text-xs ${
            entry.isMine ? 'text-right text-white/75' : 'text-[var(--knu-text-tertiary)]'
          }`}
        >
          {formatChatMessageTime(entry.timestamp)}
        </p>
      </div>
    </div>
  );
}

export default function ChatRoomView({
  room,
  seasonState,
  daysUntilEnd,
  onBack,
  onOpenProfile,
  onToggleConfirm,
  onEndConversation,
  onManageMatch,
  onBlock,
  onReport,
}: ChatRoomViewProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(() => {
    if (typeof window === 'undefined' || room.readOnly) return false;
    return window.localStorage.getItem(`chat-privacy-notice:${room.roomKey}`) !== 'dismissed';
  });

  const dismissPrivacyNotice = () => {
    window.localStorage.setItem(`chat-privacy-notice:${room.roomKey}`, 'dismissed');
    setShowPrivacyNotice(false);
  };

  const roomPolicyCard = useMemo(() => {
    if (room.chatState === 'archived') {
      return {
        icon: Archive,
        tone: 'neutral' as const,
        title: '읽기 전용 아카이브',
        description:
          '종료된 대화는 다시 읽을 수만 있어요. 채팅 데이터는 시즌 종료 후 90일 동안 보관된 뒤 삭제됩니다.',
      };
    }

    if (room.chatState === 'conversation' && room.expiresAt) {
      return {
        icon: CalendarClock,
        tone: room.expiresSoonText ? ('warning' as const) : ('info' as const),
        title: room.expiresSoonText ? '대화 종료가 가까워요' : '탐색 대화 유지 기간',
        description: `이 탐색 대화는 ${formatExactDateTime(room.expiresAt)}에 자동 종료돼요. 종료 후에는 같은 상대와 재교류할 수 없습니다.`,
      };
    }

    return {
      icon: Sparkles,
      tone: 'info' as const,
      title: '매칭 확정 대화',
      description:
        seasonState === 'SEASON_MATCHING' && daysUntilEnd > 0
          ? `매칭 확정 대화는 시즌 종료(D-${daysUntilEnd})까지 유지돼요. 호실 선택은 학교 시스템에서 직접 진행해 주세요.`
          : '매칭 확정 대화는 시즌 종료 전까지 유지돼요. 호실 선택은 학교 시스템에서 직접 진행해 주세요.',
    };
  }, [daysUntilEnd, room.chatState, room.expiresAt, room.expiresSoonText, seasonState]);

  const confirmConfig = useMemo(() => {
    switch (pendingAction) {
      case 'toggle-confirm':
        return room.selfConfirmed
          ? {
              title: '확정 완료 취소',
              message: `${room.title}님과의 확정 완료를 취소하시겠습니까?\n다시 대화를 이어가거나 종료할 수 있게 됩니다.`,
              confirmLabel: '취소하기',
              action: onToggleConfirm,
            }
          : {
              title: '매칭 확정',
              message: `${room.title}님과의 매칭을 확정하시겠습니까?\n상대도 확정하면 최종 적용됩니다.`,
              confirmLabel: '확정하기',
              action: onToggleConfirm,
            };
      case 'end-conversation':
        return {
          title: '대화 종료',
          message: `${room.title}님과의 대화를 종료하시겠습니까?\n\n종료 후 같은 상대와 재교류할 수 없습니다.`,
          warning: '종료된 대화는 읽기 전용으로만 남습니다.',
          confirmLabel: '종료하기',
          action: onEndConversation,
          variant: 'danger' as const,
        };
      case 'manage-match':
        return room.cancelState === 'requested_by_me'
          ? {
              title: '해제 요청 취소',
              message: '보낸 매칭 해제 요청을 취소하시겠습니까?',
              confirmLabel: '요청 취소',
              action: onManageMatch,
            }
          : room.cancelState === 'requested_by_other'
            ? {
                title: '매칭 해제 승인',
                message: `${room.title}님이 매칭 취소를 요청했어요.\n승인하면 매칭이 해제됩니다.`,
                confirmLabel: '승인하기',
                action: onManageMatch,
                variant: 'danger' as const,
              }
            : {
                title: '매칭 해제 요청',
                message: `${room.title}님과의 매칭 취소를 요청하시겠습니까?\n상대가 승인하면 매칭이 해제됩니다.`,
                confirmLabel: '요청하기',
                action: onManageMatch,
                variant: 'danger' as const,
              };
      case 'block':
        return {
          title: '사용자 차단',
          message: `${room.title}님을 차단하시겠습니까?\n차단하면 이 사용자는 채팅 목록에서 제거됩니다.`,
          warning: '차단 사실은 상대에게 알려지지 않아요.',
          confirmLabel: '차단하기',
          action: onBlock,
          variant: 'danger' as const,
        };
      default:
        return null;
    }
  }, [
    onBlock,
    onEndConversation,
    onManageMatch,
    onToggleConfirm,
    pendingAction,
    room.cancelState,
    room.selfConfirmed,
    room.title,
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--knu-background-alt)]">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative flex items-center gap-3 bg-[var(--knu-primary)] px-4 py-4 text-white"
      >
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-1.5 transition-colors hover:bg-white/15"
          aria-label="뒤로 가기"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={room.canOpenProfile ? onOpenProfile : undefined}
          className={`flex flex-1 items-center gap-3 rounded-2xl px-1 py-1 text-left ${
            room.canOpenProfile ? 'transition-colors hover:bg-white/10' : ''
          }`}
        >
          <RoomAvatar room={room} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold">{room.title}</h1>
              {room.canOpenProfile && <ChevronRight className="h-4 w-4 text-white/70" />}
            </div>
            <p className="truncate text-xs text-white/80">{room.contextLine}</p>
          </div>
        </button>

        {(room.canOpenProfile ||
          room.canConfirmInChat ||
          room.canManageMatchInChat ||
          room.canEndConversationInChat ||
          room.canBlock ||
          room.canReport) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="rounded-full p-1.5 transition-colors hover:bg-white/15"
              aria-label="대화 메뉴"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-2xl border border-[var(--knu-border)] bg-white shadow-xl">
                {room.canOpenProfile && (
                  <HeaderActionButton
                    icon={ChevronRight}
                    label="프로필 보기"
                    onClick={() => {
                      setShowMenu(false);
                      onOpenProfile();
                    }}
                  />
                )}

                {room.canConfirmInChat && (
                  <HeaderActionButton
                    icon={CheckCircle2}
                    label={room.selfConfirmed ? '확정 완료 취소' : '매칭 확정'}
                    onClick={() => {
                      setShowMenu(false);
                      setPendingAction('toggle-confirm');
                    }}
                  />
                )}

                {room.canEndConversationInChat && (
                  <HeaderActionButton
                    icon={XCircle}
                    label="대화 종료"
                    onClick={() => {
                      setShowMenu(false);
                      setPendingAction('end-conversation');
                    }}
                    tone="danger"
                  />
                )}

                {room.canManageMatchInChat && (
                  <HeaderActionButton
                    icon={AlertTriangle}
                    label={
                      room.cancelState === 'requested_by_me'
                        ? '해제 요청 취소'
                        : room.cancelState === 'requested_by_other'
                          ? '매칭 해제 승인'
                          : '매칭 해제 요청'
                    }
                    onClick={() => {
                      setShowMenu(false);
                      setPendingAction('manage-match');
                    }}
                    tone="danger"
                  />
                )}

                {room.canBlock && (
                  <HeaderActionButton
                    icon={Ban}
                    label="차단하기"
                    onClick={() => {
                      setShowMenu(false);
                      setPendingAction('block');
                    }}
                  />
                )}

                {room.canReport && (
                  <HeaderActionButton
                    icon={Flag}
                    label="신고하기"
                    onClick={() => {
                      setShowMenu(false);
                      setShowReportSheet(true);
                    }}
                    tone="danger"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </motion.header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          {showPrivacyNotice && (
            <PolicyCard
              icon={ShieldAlert}
              tone="warning"
              title="개인정보 공유 주의"
              description={
                '연락처, 학번, 건강 정보 같은 민감한 개인정보는 신중하게 공유해 주세요.\n서비스 밖에서 이뤄진 소통과 결과는 서비스가 보장하지 않습니다.'
              }
            />
          )}

          {showPrivacyNotice && (
            <button
              type="button"
              onClick={dismissPrivacyNotice}
              className="-mt-1 self-start rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--knu-text-secondary)] border border-[var(--knu-border)]"
            >
              확인했어요
            </button>
          )}

          <PolicyCard {...roomPolicyCard} />

          <div className="space-y-3 pb-6">
            {room.timeline.map((entry, index) => {
              const dateLabel = formatChatDateDivider(entry.timestamp);
              const previousDateLabel =
                index > 0 ? formatChatDateDivider(room.timeline[index - 1]!.timestamp) : null;
              const showDateDivider = dateLabel !== previousDateLabel;

              return (
                <div key={entry.id}>
                  {showDateDivider && (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                        {dateLabel}
                      </span>
                    </div>
                  )}
                  {entry.kind === 'system' ? (
                    <SystemEntry entry={entry} />
                  ) : (
                    <MessageEntry entry={entry} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--knu-border)] bg-white px-4 py-3">
        <div className="mx-auto max-w-md rounded-2xl bg-[var(--knu-background-alt)] px-4 py-3 text-sm text-[var(--knu-text-tertiary)]">
          {room.readOnly
            ? '이 대화는 읽기 전용이에요.'
            : seasonState !== 'SEASON_MATCHING'
              ? '시즌이 종료되어 새 메시지를 보낼 수 없어요.'
              : '메시지 전송은 현재 준비 중이에요.'}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmConfig != null}
        onClose={() => setPendingAction(null)}
        onConfirm={() => confirmConfig?.action()}
        title={confirmConfig?.title ?? ''}
        message={confirmConfig?.message ?? ''}
        warning={confirmConfig?.warning}
        confirmLabel={confirmConfig?.confirmLabel}
        variant={confirmConfig?.variant}
      />

      <ReportSheet
        isOpen={showReportSheet}
        onClose={() => setShowReportSheet(false)}
        onSubmit={(reason, detail) => {
          onReport(reason, detail);
          setShowReportSheet(false);
        }}
      />
    </div>
  );
}
