'use client';

import { HelpCircle, MessageCircle, School, ShieldAlert, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

interface HomeMatchingRegisteredGuidePanelProps {
  viewModel: HomeDashboardViewModel;
}

type GuideTone = 'blue' | 'purple' | 'amber' | 'green' | 'red' | 'slate';

interface GuideItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: GuideTone;
}

const GUIDE_TONE_CLASS: Record<GuideTone, { icon: string; card: string }> = {
  blue: {
    icon: 'bg-blue-50 text-blue-600',
    card: 'border-blue-100 bg-blue-50/55',
  },
  purple: {
    icon: 'bg-purple-50 text-purple-600',
    card: 'border-purple-100 bg-purple-50/55',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700',
    card: 'border-amber-100 bg-amber-50/55',
  },
  green: {
    icon: 'bg-emerald-50 text-emerald-600',
    card: 'border-emerald-100 bg-emerald-50/55',
  },
  red: {
    icon: 'bg-rose-50 text-rose-600',
    card: 'border-rose-100 bg-rose-50/55',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-600',
    card: 'border-slate-200 bg-slate-50/80',
  },
};

export function HomeMatchingRegisteredGuidePanel({
  viewModel,
}: HomeMatchingRegisteredGuidePanelProps) {
  const guideItems = buildMatchingRegisteredGuideItems(viewModel);

  return (
    <section className={sectionCard()} aria-labelledby="home-matching-guide-title">
      <div className={sectionHeader}>
        <div>
          <p className="mb-1 text-xs font-bold text-(--knu-primary)">매칭 시즌 안내</p>
          <h2 id="home-matching-guide-title" className="font-bold text-(--knu-text-primary)">
            매칭 전에 알아두면 좋아요
          </h2>
        </div>
        <HelpCircle className="h-5 w-5 text-(--knu-primary)" aria-hidden="true" />
      </div>

      <ul className="space-y-3">
        {guideItems.map((item) => {
          const tone = GUIDE_TONE_CLASS[item.tone];
          const Icon = item.icon;

          return (
            <li key={item.id} className={`rounded-xl border p-3 ${tone.card}`}>
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.icon}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3
                    className="text-[12px] font-bold leading-4 tracking-tight text-(--knu-text-primary) sm:text-[13px]"
                    title={item.title}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-(--knu-text-secondary)">
                    {item.description}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function buildMatchingRegisteredGuideItems(viewModel: HomeDashboardViewModel): GuideItem[] {
  const roomSelectionDescription = viewModel.matchingWindow
    ? `${viewModel.matchingWindow.roomSelectionDormitoryName} 호실 선택일: ${viewModel.matchingWindow.roomSelectionDate}`
    : '서비스는 룸메 매칭을 돕고, 실제 호실 선택은 학교 공식 기숙사 홈페이지에서 진행돼요.';

  return [
    {
      id: 'official-room-selection',
      title: '실제 호실 선택은 학교 홈페이지에서 진행해요',
      description: roomSelectionDescription,
      icon: School,
      tone: 'blue',
    },
    {
      id: 'match-not-final',
      title: '확정 전에는 서로 다른 후보와도 대화할 수 있어요',
      description: '마음이 맞으면 서비스에서 매칭을 확정해 상대를 놓치지 않도록 해주세요.',
      icon: Users,
      tone: 'purple',
    },
    {
      id: 'matched-chat',
      title: '매칭 상대와의 대화는 시즌 종료일까지 유지돼요',
      description: '기숙사에 가져갈 물품이나 생활 규칙을 미리 의논해보세요.',
      icon: MessageCircle,
      tone: 'green',
    },
    {
      id: 'safety-support',
      title: '불편한 상황은 신고하거나 문의할 수 있어요',
      description: '부적절한 닉네임·채팅은 제재될 수 있어요. 매칭 관련 불편한 사항은 문의해주세요.',
      icon: ShieldAlert,
      tone: 'slate',
    },
  ];
}
