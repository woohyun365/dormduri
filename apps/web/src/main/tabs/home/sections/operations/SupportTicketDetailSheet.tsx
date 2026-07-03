'use client';

import { useState } from 'react';
import { LifeBuoy, Send } from 'lucide-react';
import type { SupportTicketDetailResponse } from '@repo/shared/support';
import { HomeResponsiveSheet } from '../../overlays/HomeResponsiveSheet';
import type { HomeOperationsDetailState } from '../../hooks/useHomeOperations';
import { SupportTicketMessageComposer } from './SupportTicketMessageComposer';

const SUPPORT_STATUS_LABEL: Record<SupportTicketDetailResponse['ticket']['status'], string> = {
  OPEN: '접수',
  WAITING_USER: '추가 확인 필요',
  WAITING_OPERATOR: '운영자 확인 중',
  RESOLVED: '답변 완료',
  CLOSED: '종료',
};

const SUPPORT_SENDER_LABEL: Record<
  SupportTicketDetailResponse['messages'][number]['senderType'],
  string
> = {
  USER: '나',
  OPERATOR: '운영팀',
  SYSTEM: '시스템',
};

function canAppendMessage(status: SupportTicketDetailResponse['ticket']['status']) {
  return status !== 'CLOSED';
}

export function SupportTicketDetailSheet({
  detail,
  onClose,
  onAppendMessage,
}: {
  detail: Extract<HomeOperationsDetailState, { kind: 'supportTicket' }>;
  onClose: () => void;
  onAppendMessage: (body: string) => Promise<void>;
}) {
  const [message, setMessage] = useState('');

  const title = detail.status === 'success' ? detail.detail.ticket.subject : '문의 내역';
  const description =
    detail.status === 'success'
      ? `${SUPPORT_STATUS_LABEL[detail.detail.ticket.status]} 상태예요. 답변과 추가 요청을 이곳에서 확인해요.`
      : '문의 상세 정보를 확인하고 필요한 경우 추가 메시지를 남길 수 있어요.';

  const submitDisabled =
    detail.status !== 'success' ||
    detail.submittingMessage ||
    !message.trim() ||
    !canAppendMessage(detail.detail.ticket.status);

  return (
    <HomeResponsiveSheet
      label="문의 내역"
      eyebrow="문의하기"
      title={title}
      description={description}
      icon={LifeBuoy}
      tone="blue"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-(--knu-border) bg-white px-4 py-3 text-sm font-bold text-(--knu-text-secondary) transition-colors hover:bg-(--knu-background-alt) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => {
              const nextMessage = message;
              void onAppendMessage(nextMessage).then(() => setMessage(''));
            }}
            disabled={submitDisabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-(--knu-primary) px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark) disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
          >
            <Send className="size-4" aria-hidden="true" />
            추가 메시지
          </button>
        </>
      }
    >
      {detail.status === 'loading' && (
        <div className="space-y-3" aria-label="문의 상세 로딩 중">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-(--knu-background-alt)" />
          ))}
        </div>
      )}

      {detail.status === 'error' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">{detail.message}</p>
        </div>
      )}

      {detail.status === 'success' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-(--knu-border) bg-(--knu-background-alt) p-4">
            <p className="text-xs font-bold text-(--knu-text-tertiary)">상태</p>
            <p className="mt-1 text-sm font-extrabold text-(--knu-text-primary)">
              {SUPPORT_STATUS_LABEL[detail.detail.ticket.status]}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-(--knu-text-tertiary)">메시지</p>
            {detail.detail.messages.map((messageItem) => (
              <div
                key={messageItem.id}
                className={`rounded-2xl border p-3 ${
                  messageItem.senderType === 'USER'
                    ? 'border-blue-100 bg-blue-50/70'
                    : 'border-(--knu-border) bg-white'
                }`}
              >
                <p className="text-[11px] font-bold text-(--knu-text-tertiary)">
                  {SUPPORT_SENDER_LABEL[messageItem.senderType]}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-(--knu-text-primary)">
                  {messageItem.body}
                </p>
              </div>
            ))}
          </div>

          {canAppendMessage(detail.detail.ticket.status) ? (
            <SupportTicketMessageComposer
              value={message}
              disabled={false}
              submitting={detail.submittingMessage}
              error={detail.messageError}
              onChange={setMessage}
            />
          ) : (
            <p className="rounded-2xl bg-(--knu-background-alt) p-3 text-xs font-bold text-(--knu-text-secondary)">
              종료된 문의는 읽기 전용이에요. 추가 문의가 필요하면 새 문의를 남겨주세요.
            </p>
          )}
        </div>
      )}
    </HomeResponsiveSheet>
  );
}
