'use client';

import { useMemo, useState } from 'react';
import { Archive, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import type { ConversationThreadSummary } from '@repo/shared/chat';
import type { MatchingNavOptions, TabId } from '@/main/model/navigation';
import ChatRoomView from './ChatRoomView';
import { useChatThreadDetail } from './hooks/useChatThreadDetail';
import { useChatThreads } from './hooks/useChatThreads';

function statusLabel(thread: ConversationThreadSummary): string {
  if (thread.status === 'OPEN') return thread.threadKind === 'MATCHED' ? '매칭 대화' : '대화 중';
  if (thread.status === 'READ_ONLY') return '읽기 전용';
  return '보관됨';
}

function formatThreadTime(value: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(
    new Date(value),
  );
}

function ThreadCard({
  thread,
  onClick,
}: {
  thread: ConversationThreadSummary;
  onClick: () => void;
}) {
  const readOnly = thread.status !== 'OPEN';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-(--knu-border) bg-white p-4 text-left transition hover:border-(--knu-primary)/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-(--knu-text-primary)">대화 상대</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {statusLabel(thread)}
            </span>
          </div>
          <p className="mt-2 text-xs text-(--knu-text-secondary)">
            {readOnly
              ? '이 대화는 읽기 전용으로 보관돼요.'
              : '대화 내용을 확인하고 메시지를 보낼 수 있어요.'}
          </p>
        </div>
        <span className="shrink-0 text-xs text-(--knu-text-tertiary)">
          {formatThreadTime(thread.lastMessageAt)}
        </span>
      </div>
    </button>
  );
}

export default function ChatTab({
  viewerId,
  onNavigate,
}: {
  viewerId: string;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const threads = useChatThreads({ identityKey: viewerId });
  const detail = useChatThreadDetail(selectedThreadId);
  const openThreads = useMemo(
    () => (threads.data?.items ?? []).filter((thread) => thread.status === 'OPEN'),
    [threads.data],
  );
  const archivedThreads = useMemo(
    () => (threads.data?.items ?? []).filter((thread) => thread.status !== 'OPEN'),
    [threads.data],
  );

  if (selectedThreadId) {
    if (detail.loading) {
      return (
        <div className="p-6 text-center text-sm text-(--knu-text-secondary)">
          대화를 불러오는 중이에요.
        </div>
      );
    }
    if (detail.error || !detail.data) {
      return (
        <div className="p-6 text-center">
          <p role="alert" className="text-sm text-(--knu-text-secondary)">
            대화를 불러오지 못했어요.
          </p>
          <button
            type="button"
            onClick={() => void detail.refresh()}
            className="mt-4 rounded-xl bg-(--knu-primary) px-4 py-2 text-sm font-semibold text-white"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => setSelectedThreadId(null)}
            className="ml-2 mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-(--knu-primary)"
          >
            목록으로
          </button>
        </div>
      );
    }
    return (
      <ChatRoomView
        detail={detail.data}
        viewerId={viewerId}
        onBack={() => setSelectedThreadId(null)}
        onRefresh={async () => {
          await Promise.all([detail.refresh(), threads.refresh()]);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-(--knu-background-alt)">
      <header className="bg-(--knu-primary) px-5 py-6 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <MessageCircle className="size-6" />
          <div>
            <h1 className="text-2xl font-bold">채팅</h1>
            <p className="text-sm text-white/85">대화 권한과 상태는 채팅 서비스에서 관리해요.</p>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        {threads.loading ? (
          <p className="py-10 text-center text-sm text-(--knu-text-secondary)">
            채팅 목록을 불러오는 중이에요.
          </p>
        ) : null}
        {threads.error ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-white p-5 text-center text-sm text-(--knu-text-secondary)"
          >
            채팅 목록을 불러오지 못했어요.
            <button
              type="button"
              onClick={() => void threads.refresh()}
              className="ml-2 font-semibold text-(--knu-primary)"
            >
              다시 시도
            </button>
          </div>
        ) : null}
        {!threads.loading &&
        !threads.error &&
        openThreads.length === 0 &&
        archivedThreads.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-(--knu-border) bg-white px-5 py-10 text-center">
            <MessageCircle className="mx-auto size-8 text-(--knu-text-tertiary)" />
            <h2 className="mt-3 text-base font-bold">아직 열린 대화가 없어요</h2>
            <p className="mt-2 text-sm text-(--knu-text-secondary)">
              매칭 요청을 수락한 뒤 대화를 시작할 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('matching')}
              className="mt-5 rounded-xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white"
            >
              매칭 현황 보기
            </button>
          </div>
        ) : null}
        {openThreads.map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            onClick={() => setSelectedThreadId(thread.id)}
          />
        ))}
        {archivedThreads.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-(--knu-border) bg-white">
            <button
              type="button"
              onClick={() => setArchiveOpen((open) => !open)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span>
                <span className="block text-sm font-bold">지난 대화</span>
                <span className="mt-1 block text-xs text-(--knu-text-secondary)">
                  읽기 전용 대화를 확인할 수 있어요.
                </span>
              </span>
              {archiveOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {archiveOpen ? (
              <div className="space-y-3 border-t border-(--knu-border) bg-(--knu-background-alt) p-3">
                {archivedThreads.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    onClick={() => setSelectedThreadId(thread.id)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
        {threads.data?.pageInfo.hasNextPage ? (
          <div className="text-center">
            <button
              type="button"
              onClick={() => void threads.loadMore()}
              disabled={threads.loadingMore}
              className="rounded-xl border border-(--knu-border) bg-white px-4 py-2 text-sm font-semibold text-(--knu-primary) disabled:opacity-50"
            >
              {threads.loadingMore ? '대화를 더 불러오는 중이에요.' : '대화 더 불러오기'}
            </button>
            {threads.loadMoreError ? (
              <p role="alert" className="mt-2 text-xs text-rose-700">
                대화를 더 불러오지 못했어요. 다시 시도해주세요.
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="flex items-center gap-2 px-1 text-xs text-(--knu-text-tertiary)">
          <Archive className="size-3.5" /> 매칭 확정·해제 같은 lifecycle 작업은 매칭 현황에서만
          처리할 수 있어요.
        </p>
      </main>
    </div>
  );
}
