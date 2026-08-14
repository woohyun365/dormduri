'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Archive, MessageCircle, Send } from 'lucide-react';
import type { ConversationThreadDetailResponse } from '@repo/shared/chat';
import type { ReportReason } from '@repo/shared/social-safety/report';
import { chatApi } from './api/chat.api';
import { ChatReportSheet } from './ChatReportSheet';

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function unavailableMessage(reason: string | null): string {
  switch (reason) {
    case 'THREAD_READ_ONLY':
    case 'ARCHIVED_THREAD':
    case 'MEMBER_LEFT':
    case 'SEASON_ENDED':
      return '이 대화는 읽기 전용이에요.';
    case 'TARGET_DELETED_OR_DEIDENTIFIED':
    case 'SAFETY_OR_VISIBILITY_RESTRICTED':
      return '현재 이 대화에는 메시지를 보낼 수 없어요.';
    default:
      return '현재 메시지를 보낼 수 없어요.';
  }
}

export default function ChatRoomView({
  detail,
  viewerId,
  onBack,
  onRefresh,
}: {
  detail: ConversationThreadDetailResponse;
  viewerId: string;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { thread, messages } = detail;
  const lastMessageId = messages.at(-1)?.id;

  useEffect(() => {
    if (!lastMessageId) return;
    void chatApi
      .updateReadMarker(thread.id, { lastReadMessageId: lastMessageId })
      .catch(() => undefined);
  }, [lastMessageId, thread.id]);

  const send = async () => {
    if (!thread.canSendMessage || !body.trim() || sending) return;
    setSending(true);
    setActionError(null);
    try {
      await chatApi.sendMessage({
        targetUserId: thread.counterpartUserId,
        body: body.trim(),
        clientMessageId: globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}`,
      });
      setBody('');
      await onRefresh();
    } catch {
      setActionError('메시지를 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  };

  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    setActionError(null);
    try {
      await chatApi.leaveThread(thread.id);
      await onRefresh();
      onBack();
    } catch {
      setActionError('대화방을 나가지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLeaving(false);
    }
  };

  const report = async (input: { reason: ReportReason; detail: string | null }) => {
    setActionError(null);
    try {
      await chatApi.createReport({
        targetType: 'CHAT_THREAD',
        targetId: thread.id,
        reason: input.reason,
        detail: input.detail,
        evidenceAttachmentIds: [],
        optionalAction: null,
        falseReportDisclaimerAccepted: true,
      });
      setReportOpen(false);
    } catch {
      setActionError('신고를 접수하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-(--knu-background-alt)">
      <header className="border-b border-(--knu-border) bg-white px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl p-2 text-(--knu-text-secondary) hover:bg-(--knu-background-alt)"
            aria-label="채팅 목록으로 돌아가기"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-(--knu-text-primary)">대화 상대</h1>
            <p className="text-xs text-(--knu-text-secondary)">
              {thread.status === 'OPEN' ? '대화 가능' : '읽기 전용'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void leave()}
            disabled={leaving || thread.status === 'ARCHIVED'}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            나가기
          </button>
        </div>
      </header>

      <main
        className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 py-5"
        aria-live="polite"
      >
        {thread.status !== 'OPEN' ? (
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-(--knu-text-secondary)">
            <Archive className="mt-0.5 size-5 shrink-0" />
            <p>{unavailableMessage(thread.sendMessageUnavailableReason)}</p>
          </div>
        ) : null}
        {thread.canReport ? (
          <div className="flex items-center justify-between gap-3 px-1 text-xs text-(--knu-text-tertiary)">
            <p>안전 문제가 있으면 운영 정책에 따라 신고할 수 있어요.</p>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="shrink-0 font-semibold text-rose-700 underline"
            >
              신고하기
            </button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="my-auto rounded-2xl border border-dashed border-(--knu-border) bg-white px-5 py-10 text-center">
            <MessageCircle className="mx-auto size-8 text-(--knu-text-tertiary)" />
            <p className="mt-3 text-sm text-(--knu-text-secondary)">아직 메시지가 없어요.</p>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.senderUserId === viewerId;
            const hidden = message.bodyState !== 'PLAIN';
            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${
                    mine
                      ? 'rounded-br-sm bg-(--knu-primary) text-white'
                      : 'rounded-bl-sm border border-(--knu-border) bg-white text-(--knu-text-primary)'
                  }`}
                >
                  <p className={hidden ? 'italic opacity-70' : ''}>
                    {hidden ? '삭제되었거나 더 이상 볼 수 없는 메시지예요.' : message.body}
                  </p>
                  <p
                    className={`mt-1 text-xs ${mine ? 'text-white/75' : 'text-(--knu-text-tertiary)'}`}
                  >
                    {formatMessageTime(message.sentAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </main>

      <form
        className="border-t border-(--knu-border) bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className="mx-auto flex max-w-md gap-2">
          <label className="sr-only" htmlFor="chat-message">
            메시지
          </label>
          <input
            id="chat-message"
            value={body}
            maxLength={1000}
            disabled={!thread.canSendMessage || sending}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              thread.canSendMessage
                ? '메시지를 입력하세요'
                : unavailableMessage(thread.sendMessageUnavailableReason)
            }
            className="min-w-0 flex-1 rounded-xl border border-(--knu-border) px-3 py-2 text-sm disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!thread.canSendMessage || !body.trim() || sending}
            className="rounded-xl bg-(--knu-primary) px-3 text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="메시지 보내기"
          >
            <Send className="size-4" />
          </button>
        </div>
        {actionError ? (
          <p role="alert" className="mx-auto mt-2 max-w-md text-xs text-rose-700">
            {actionError}
          </p>
        ) : null}
      </form>
      {reportOpen ? (
        <ChatReportSheet onClose={() => setReportOpen(false)} onSubmit={report} />
      ) : null}
    </div>
  );
}
