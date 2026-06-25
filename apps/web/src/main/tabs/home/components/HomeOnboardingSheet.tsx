'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { Building2, CheckCircle2, Search, Sparkles, UserRound, X } from 'lucide-react';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';
import type { TabId, MatchingNavOptions } from '@/types/profile';

interface HomeOnboardingSheetProps {
  open: boolean;
  viewModel: HomeDashboardViewModel;
  dismissing?: boolean;
  error?: string | null;
  onClose: () => void;
  onDismissPermanently: () => Promise<void> | void;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenBuildingSelect?: () => void;
}

interface OnboardingAction {
  label: string;
  description: string;
  icon: typeof Sparkles;
  onClick: () => void;
}

export function HomeOnboardingSheet({
  open,
  viewModel,
  dismissing = false,
  error,
  onClose,
  onDismissPermanently,
  onNavigate,
  onOpenBuildingSelect,
}: HomeOnboardingSheetProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const actions = useMemo(
    () =>
      buildOnboardingActions({
        viewModel,
        onNavigate,
        onOpenBuildingSelect,
        onClose,
      }),
    [onClose, onNavigate, onOpenBuildingSelect, viewModel],
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.hasAttribute('hidden'));
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements.at(0);
        const lastElement = focusableElements.at(-1);
        if (!firstElement || !lastElement) return;

        const activeElement = document.activeElement;

        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
          return;
        }

        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
          return;
        }

        if (activeElement instanceof HTMLElement && !dialog.contains(activeElement)) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-4 py-4 md:items-center">
      <motion.section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-onboarding-title"
        aria-describedby="home-onboarding-description"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5"
      >
        <div className="bg-linear-to-br from-blue-50 to-cyan-50 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold text-blue-700">처음 이용 안내</p>
                <h2
                  id="home-onboarding-title"
                  className="text-lg font-extrabold text-(--knu-text-primary)"
                >
                  서비스 시작 전 알아두기
                </h2>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-(--knu-text-secondary) transition-colors hover:bg-white hover:text-(--knu-text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
              aria-label="서비스 안내 닫기"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p
            id="home-onboarding-description"
            className="text-sm leading-relaxed text-(--knu-text-secondary)"
          >
            KNU 룸메는 시즌 상태에 따라 프로필 준비, 건물 선택, 룸메 탐색, 매칭 결과 확인을 순서대로
            안내해요. 홈에서는 지금 할 수 있는 행동만 직접 눌러 시작할 수 있어요.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-(--knu-border) bg-(--knu-background-alt) p-3 text-left transition-colors hover:border-(--knu-primary) hover:bg-blue-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-(--knu-primary) shadow-sm">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-(--knu-text-primary)">
                      {action.label}
                    </span>
                    <span className="block text-xs leading-relaxed text-(--knu-text-tertiary)">
                      {action.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
            <CheckCircle2 className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
            안내를 닫아도 홈의 준비 체크리스트에서 다음 행동을 계속 확인할 수 있어요.
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-(--knu-border) bg-white px-4 text-sm font-bold text-(--knu-text-secondary) transition-colors hover:bg-(--knu-background-alt)"
            >
              나중에 볼게요
            </button>
            <button
              type="button"
              onClick={() => {
                void onDismissPermanently();
              }}
              disabled={dismissing}
              className="min-h-11 rounded-xl bg-(--knu-primary) px-4 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {dismissing ? '저장 중...' : '다시 보지 않기'}
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function buildOnboardingActions({
  viewModel,
  onNavigate,
  onOpenBuildingSelect,
  onClose,
}: {
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenBuildingSelect?: () => void;
  onClose: () => void;
}): OnboardingAction[] {
  if (!viewModel.isCampusOperated || !viewModel.hasCurrentSeason) {
    return [
      {
        label: '내 프로필 확인',
        description: '운영 또는 새 시즌이 열리기 전에는 내 정보와 이전 기록 중심으로 확인해요.',
        icon: UserRound,
        onClick: () => {
          onClose();
          onNavigate('profile');
        },
      },
    ];
  }

  if (!viewModel.preparation.hasSeasonProfile) {
    return [
      {
        label: '시즌 프로필 먼저 입력',
        description: '시즌 참여에 필요한 생활패턴과 조건을 채워 등록을 준비해요.',
        icon: UserRound,
        onClick: () => {
          onClose();
          onNavigate('profile');
        },
      },
    ];
  }

  if (!viewModel.preparation.hasBuilding && viewModel.capabilities.canSelectDormitory) {
    return [
      {
        label: '건물 선택하기',
        description: '건물을 선택해야 같은 건물 기준의 후보 탐색과 매칭 요청이 가능해요.',
        icon: Building2,
        onClick: () => {
          onClose();
          onOpenBuildingSelect?.();
        },
      },
      {
        label: '프로필 다시 확인',
        description: '등록 전에 생활패턴과 표시 정보를 한 번 더 확인해요.',
        icon: UserRound,
        onClick: () => {
          onClose();
          onNavigate('profile');
        },
      },
    ];
  }

  if (viewModel.capabilities.canEnterRoommateSearch) {
    return [
      {
        label: '룸메 후보 보기',
        description: '같은 건물 기준으로 후보를 확인하고 대화나 매칭 요청을 시작해요.',
        icon: Search,
        onClick: () => {
          onClose();
          onNavigate('list');
        },
      },
      {
        label: '매칭 현황 확인',
        description: '보낸 요청과 받은 요청, 확정 결과를 함께 확인할 수 있어요.',
        icon: CheckCircle2,
        onClick: () => {
          onClose();
          onNavigate('matching', { section: 'current' });
        },
      },
    ];
  }

  return [
    {
      label: '내 프로필 확인',
      description: '현재 시즌 상태에서 가능한 다음 행동을 프로필 화면에서 확인해요.',
      icon: UserRound,
      onClick: () => {
        onClose();
        onNavigate('profile');
      },
    },
  ];
}
