'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Clock3,
  Info,
  MessageCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { isCampusOperated } from '@/constants/dormitory';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import { getAvatarColor } from '@/utils/avatarColor';
import { MatchingBadge } from '@/main/components/matching/MatchingBadge';
import { ProfileDetailSheet } from '@/main/components/profile-detail/ProfileDetailSheet';
import type { ActiveMatch, MatchRequest } from '@/types/match';
import type { RoommateProfile, UserProfile, TabId, MatchingNavOptions } from '@/types/profile';
import type { ReportReason } from '@/types/report';
import ChatRoomView from './ChatRoomView';
import { deriveChatRooms, formatChatListTime, type ChatRoomSummary } from './chatViewModel';

interface ChatTabProps {
  user: UserProfile;
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  matchRequests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  blockedUserIds: Set<string>;
  onBlock: (userId: string, nickname: string) => void;
  onReport: (userId: string, reason: ReportReason, detail: string | null) => void;
  onConfirmMatch: (requestId: string) => void;
  onRevokeConfirmMatch: (requestId: string) => void;
  onEndConversation: (requestId: string) => void;
  onEndMatch: () => void;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}

function HeaderSubtitle({ operated, seasonLabel }: { operated: boolean; seasonLabel: string }) {
  return (
    <p className="text-sm text-white/85">
      {operated ? seasonLabel : '이 캠퍼스는 현재 채팅 서비스를 운영하지 않아요'}
    </p>
  );
}

function StatusPill({ room }: { room: ChatRoomSummary }) {
  const className =
    room.chatState === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : room.chatState === 'conversation'
        ? 'bg-blue-100 text-blue-700'
        : room.sourceStatus === 'UNMATCHED'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {room.statusLabel}
    </span>
  );
}

function RoomAvatar({ room }: { room: ChatRoomSummary }) {
  const color = getAvatarColor(room.title);
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${color.bg} ${color.text}`}
    >
      {room.title.charAt(0)}
    </div>
  );
}

function ChatRoomCard({ room, onClick }: { room: ChatRoomSummary; onClick: () => void }) {
  const cardTone =
    room.chatState === 'active'
      ? 'border-emerald-200 bg-emerald-50/80'
      : room.chatState === 'archived'
        ? 'border-slate-200 bg-slate-50/80'
        : 'border-[var(--knu-border)] bg-white';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`w-full rounded-2xl border-2 p-4 text-left transition-all hover:shadow-sm ${cardTone}`}
    >
      <div className="flex items-start gap-3">
        <RoomAvatar room={room} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-bold text-[var(--knu-text-primary)]">
                  {room.title}
                </h3>
                <StatusPill room={room} />
                {room.readOnly && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--knu-text-tertiary)] border border-[var(--knu-border)]">
                    읽기 전용
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--knu-text-secondary)]">{room.contextLine}</p>
            </div>
            <span className="shrink-0 text-xs text-[var(--knu-text-tertiary)]">
              {formatChatListTime(room.lastActivityAt)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {room.scoreType && (
              <MatchingBadge
                score={room.matchScore ?? 0}
                gated={room.scoreType === 'gated'}
                partial={room.scoreType === 'partial'}
                size="sm"
              />
            )}
            {room.expiresSoonText && (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">
                {room.expiresSoonText}
              </span>
            )}
          </div>

          <p
            className={`mt-2 truncate text-sm ${
              room.chatState === 'archived'
                ? 'text-[var(--knu-text-tertiary)]'
                : 'text-[var(--knu-text-secondary)]'
            }`}
          >
            {room.previewText}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

function PolicyBanner({
  icon: Icon,
  tone,
  text,
}: {
  icon: typeof Info;
  tone: 'info' | 'warning' | 'neutral';
  text: string;
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : tone === 'neutral'
        ? 'border-slate-200 bg-white text-[var(--knu-text-secondary)]'
        : 'border-blue-200 bg-blue-50 text-blue-800';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${toneClass}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="text-sm font-medium leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}

function EmptyChatState({ onNavigateMatching }: { onNavigateMatching: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[var(--knu-border)] bg-white px-5 py-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--knu-background-alt)] text-[var(--knu-text-tertiary)]">
        <MessageCircle className="h-7 w-7" />
      </div>
      <h2 className="text-base font-bold text-[var(--knu-text-primary)]">
        아직 열린 대화가 없어요
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--knu-text-secondary)]">
        매칭 현황에서 요청을 수락하면 채팅방이 생성되고,
        <br />
        상대와 대화를 시작할 수 있어요.
      </p>
      <button
        type="button"
        onClick={onNavigateMatching}
        className="mt-5 rounded-xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--knu-primary-hover)]"
      >
        매칭 현황 보기
      </button>
    </div>
  );
}

export default function ChatTab({
  user,
  profiles,
  matchRequests,
  activeMatch,
  blockedUserIds,
  onBlock,
  onReport,
  onConfirmMatch,
  onRevokeConfirmMatch,
  onEndConversation,
  onEndMatch,
  onNavigate,
}: ChatTabProps) {
  const season = useSeasonContext();
  const [selectedRoomKey, setSelectedRoomKey] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const operated = isCampusOperated(user.campus);

  const rooms = useMemo(
    () =>
      deriveChatRooms({
        currentUser: user,
        profiles,
        matchRequests,
        activeMatch,
        blockedUserIds,
      }),
    [activeMatch, blockedUserIds, matchRequests, profiles, user],
  );

  const activeRooms = rooms.filter((room) => room.chatState === 'active');
  const conversationRooms = rooms.filter((room) => room.chatState === 'conversation');
  const archivedRooms = rooms.filter((room) => room.chatState === 'archived');
  const selectedRoom = rooms.find((room) => room.roomKey === selectedRoomKey) ?? null;
  const effectiveArchiveOpen =
    archiveOpen ||
    (activeRooms.length === 0 && conversationRooms.length === 0 && archivedRooms.length > 0);

  const seasonLabel =
    season.state === 'SEASON_MATCHING'
      ? `시즌 매칭 중${season.daysUntilEnd > 0 ? ` · D-${season.daysUntilEnd}` : ''}`
      : season.state === 'SEASON_OPEN'
        ? '매칭 준비 중 · 채팅은 시즌 매칭부터 열려요'
        : '비시즌 · 종료된 대화만 읽을 수 있어요';

  const banner = !operated
    ? {
        icon: ShieldAlert,
        tone: 'warning' as const,
        text: '이 캠퍼스는 현재 채팅 서비스를 운영하지 않아요. 운영 중 생성된 대화가 있다면 읽기 전용으로만 확인할 수 있어요.',
      }
    : season.state === 'OFF_SEASON'
      ? {
          icon: Archive,
          tone: 'neutral' as const,
          text: '시즌 종료 후 진행 중 대화는 모두 읽기 전용으로 전환돼요. 채팅 데이터는 시즌 종료 후 90일 동안 보관된 뒤 삭제됩니다.',
        }
      : season.state === 'SEASON_OPEN'
        ? {
            icon: Info,
            tone: 'info' as const,
            text: '지금은 프로필과 매칭 준비를 정리하는 기간이에요. 채팅은 시즌 매칭부터 열리고, 대화는 수락 후 7일 동안 유지됩니다.',
          }
        : conversationRooms.some((room) => room.expiresSoonText)
          ? {
              icon: Clock3,
              tone: 'warning' as const,
              text: '탐색 대화는 수락 후 7일 동안 유지돼요. 만료 24시간 전부터는 방 안과 목록에서 종료 예정 안내를 다시 보여줍니다.',
            }
          : null;

  const openProfileSheet = () => {
    if (selectedRoom?.canOpenProfile) {
      setProfileSheetOpen(true);
    }
  };

  const handleToggleConfirm = () => {
    if (!selectedRoom?.requestId) return;
    if (selectedRoom.selfConfirmed) {
      onRevokeConfirmMatch(selectedRoom.requestId);
      return;
    }
    onConfirmMatch(selectedRoom.requestId);
  };

  const handleEndConversation = () => {
    if (!selectedRoom?.requestId) return;
    onEndConversation(selectedRoom.requestId);
  };

  const handleBlockRoomPartner = () => {
    if (!selectedRoom?.partnerUserId) return;
    onBlock(selectedRoom.partnerUserId, selectedRoom.title);
    setSelectedRoomKey(null);
    setProfileSheetOpen(false);
  };

  const handleReportRoomPartner = (reason: ReportReason, detail: string | null) => {
    if (!selectedRoom?.partnerUserId) return;
    onReport(selectedRoom.partnerUserId, reason, detail);
  };

  if (selectedRoom) {
    return (
      <>
        <ChatRoomView
          key={selectedRoom.roomKey}
          room={selectedRoom}
          seasonState={season.state}
          daysUntilEnd={season.daysUntilEnd}
          onBack={() => {
            setSelectedRoomKey(null);
            setProfileSheetOpen(false);
          }}
          onOpenProfile={openProfileSheet}
          onToggleConfirm={handleToggleConfirm}
          onEndConversation={handleEndConversation}
          onManageMatch={onEndMatch}
          onBlock={handleBlockRoomPartner}
          onReport={handleReportRoomPartner}
        />

        <ProfileDetailSheet
          profile={selectedRoom.profile}
          isOpen={profileSheetOpen && selectedRoom.profile != null}
          onClose={() => setProfileSheetOpen(false)}
          onRequestMatch={() => {}}
          hideMatchButton
          scoreType={selectedRoom.scoreType ?? undefined}
          userLifestyle={user.lifestyle}
          customFooter={
            <div className="px-5 py-4 text-sm text-[var(--knu-text-secondary)]">
              채팅 중에도 프로필은 계속 확인할 수 있어요.
            </div>
          }
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)]">
      <header className="bg-[var(--knu-primary)] px-5 py-6 text-white">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold">채팅</h1>
              <HeaderSubtitle operated={operated} seasonLabel={seasonLabel} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        {banner && <PolicyBanner {...banner} />}

        {activeRooms.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-emerald-700">매칭 확정</h2>
            </div>
            <div className="space-y-3">
              {activeRooms.map((room) => (
                <ChatRoomCard
                  key={room.roomKey}
                  room={room}
                  onClick={() => setSelectedRoomKey(room.roomKey)}
                />
              ))}
            </div>
          </section>
        )}

        {conversationRooms.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <MessageCircle className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-blue-700">대화 중</h2>
            </div>
            <div className="space-y-3">
              {conversationRooms.map((room) => (
                <ChatRoomCard
                  key={room.roomKey}
                  room={room}
                  onClick={() => setSelectedRoomKey(room.roomKey)}
                />
              ))}
            </div>
          </section>
        )}

        {activeRooms.length === 0 &&
          conversationRooms.length === 0 &&
          archivedRooms.length === 0 && (
            <EmptyChatState onNavigateMatching={() => onNavigate('matching')} />
          )}

        {archivedRooms.length > 0 && (
          <section className="rounded-2xl border border-[var(--knu-border)] bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setArchiveOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <div>
                <h2 className="text-sm font-bold text-[var(--knu-text-primary)]">지난 대화</h2>
                <p className="mt-1 text-xs text-[var(--knu-text-secondary)]">
                  종료된 대화는 읽기 전용으로 남고, 시즌 종료 후 90일 동안만 보관돼요.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[var(--knu-text-tertiary)]">
                <span className="text-xs font-semibold">{archivedRooms.length}</span>
                {effectiveArchiveOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {effectiveArchiveOpen && (
              <div className="border-t border-[var(--knu-border)] px-4 py-4 space-y-3 bg-[var(--knu-background-alt)]/60">
                {archivedRooms.map((room) => (
                  <ChatRoomCard
                    key={room.roomKey}
                    room={room}
                    onClick={() => setSelectedRoomKey(room.roomKey)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
