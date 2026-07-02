'use client';

import { useState } from 'react';
import { Bell, LifeBuoy, Megaphone, MessageSquareText, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Z_INDEX } from '@/constants/ui';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { sectionCard, sectionHeader } from '@/main/styles/home';

type OperationPanel = 'notice' | 'notification' | 'support';

type OperationTone = 'blue' | 'purple' | 'emerald';

interface OperationCard {
  id: OperationPanel;
  title: string;
  helper: string;
  fallback: string;
  actionLabel: string;
  icon: LucideIcon;
  tone: OperationTone;
}

const OPERATION_CARDS: OperationCard[] = [
  {
    id: 'notice',
    title: '공지사항',
    helper: '시즌 일정과 운영 공지를 확인해요.',
    fallback: '새 공지사항이 없어요.',
    actionLabel: '공지 확인',
    icon: Megaphone,
    tone: 'blue',
  },
  {
    id: 'notification',
    title: '알림함',
    helper: '매칭 요청과 문의 답변 알림을 모아봐요.',
    fallback: '새 알림이 없어요.',
    actionLabel: '알림 확인',
    icon: Bell,
    tone: 'purple',
  },
  {
    id: 'support',
    title: '문의하기',
    helper: '계정·시즌·매칭 문제를 문의할 수 있어요.',
    fallback: '진행 중인 문의가 없어요.',
    actionLabel: '문의 확인',
    icon: LifeBuoy,
    tone: 'emerald',
  },
];

const OPERATION_TONE_CLASS: Record<OperationTone, { icon: string; hover: string; border: string }> =
  {
    blue: {
      icon: 'bg-blue-50 text-blue-600',
      hover: 'hover:border-blue-200 hover:bg-blue-50/55',
      border: 'border-blue-100',
    },
    purple: {
      icon: 'bg-purple-50 text-purple-600',
      hover: 'hover:border-purple-200 hover:bg-purple-50/55',
      border: 'border-purple-100',
    },
    emerald: {
      icon: 'bg-emerald-50 text-emerald-600',
      hover: 'hover:border-emerald-200 hover:bg-emerald-50/55',
      border: 'border-emerald-100',
    },
  };

export function HomeOperationsPanel() {
  const [activePanel, setActivePanel] = useState<OperationPanel | null>(null);
  const selectedCard = OPERATION_CARDS.find((card) => card.id === activePanel) ?? null;

  return (
    <>
      <section className={sectionCard()} aria-labelledby="home-operations-title">
        <div className={sectionHeader}>
          <div>
            <p className="mb-1 text-xs font-bold text-(--knu-primary)">운영 센터</p>
            <h2 id="home-operations-title" className="font-bold text-(--knu-text-primary)">
              필요한 소식을 확인해요
            </h2>
          </div>
          <MessageSquareText className="h-5 w-5 text-(--knu-primary)" aria-hidden="true" />
        </div>

        <div className="space-y-2.5">
          {OPERATION_CARDS.map((card) => {
            const Icon = card.icon;
            const tone = OPERATION_TONE_CLASS[card.tone];

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setActivePanel(card.id)}
                className={`w-full rounded-xl border border-(--knu-border) bg-white/80 p-3 text-left transition-colors ${tone.hover}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.icon}`}
                  >
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-(--knu-text-primary)">
                        {card.title}
                      </span>
                      <span className="rounded-full bg-(--knu-background-alt) px-2 py-0.5 text-[11px] font-bold text-(--knu-text-secondary)">
                        {card.fallback}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-(--knu-text-secondary)">
                      {card.helper}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <HomeOperationsDialog card={selectedCard} onClose={() => setActivePanel(null)} />
    </>
  );
}

function HomeOperationsDialog({
  card,
  onClose,
}: {
  card: OperationCard | null;
  onClose: () => void;
}) {
  const open = card !== null;
  useBodyScrollLock(open);
  const focusRef = useFocusTrap(open, onClose);

  if (!card) return null;

  const Icon = card.icon;
  const tone = OPERATION_TONE_CLASS[card.tone];
  const bodyCopy = getDialogBodyCopy(card.id);

  return (
    <div
      className="fixed inset-0 flex items-end justify-center bg-slate-950/35 px-4 pb-4 pt-10 backdrop-blur-sm md:items-center md:p-6"
      style={{ zIndex: Z_INDEX.bottomSheet }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={focusRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-operations-dialog-title"
        className="max-h-[min(36rem,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl outline-none md:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.icon}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="mb-1 text-xs font-bold text-(--knu-primary)">운영 센터</p>
              <h2
                id="home-operations-dialog-title"
                className="text-lg font-bold text-(--knu-text-primary)"
              >
                {card.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-(--knu-text-tertiary) transition-colors hover:bg-(--knu-background-alt) hover:text-(--knu-text-primary)"
            aria-label="닫기"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className={`rounded-2xl border p-4 ${tone.border} bg-(--knu-background-alt)`}>
          <p className="text-sm font-bold text-(--knu-text-primary)">{card.fallback}</p>
          <p className="mt-2 text-sm leading-relaxed text-(--knu-text-secondary)">{bodyCopy}</p>
        </div>
      </div>
    </div>
  );
}

function getDialogBodyCopy(panel: OperationPanel): string {
  switch (panel) {
    case 'notice':
      return '중요한 시즌 일정과 운영 공지는 이 영역에서 확인할 수 있도록 연결할 예정이에요.';
    case 'notification':
      return '매칭 요청, 문의 답변, 시즌 공지처럼 확인이 필요한 알림이 생기면 이곳에 표시돼요.';
    case 'support':
      return '문의 내역과 답변 흐름은 지원 티켓 API를 기준으로 연결할 예정이에요.';
  }
}
