'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Building2, CheckCircle2, Search, Sparkles, UserRound, X } from 'lucide-react';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';
import type { TabId, MatchingNavOptions } from '@/types/profile';

interface HomeOnboardingSheetProps {
  open: boolean;
  viewModel: HomeDashboardViewModel;
  dismissing?: boolean;
  error?: string | null;
  onClose: () => void;
  onDismissForToday: () => void;
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

interface OnboardingSupportMessage {
  title: string;
  description: string;
}

export function HomeOnboardingSheet({
  open,
  viewModel,
  dismissing = false,
  error,
  onClose,
  onDismissForToday,
  onDismissPermanently,
  onNavigate,
  onOpenBuildingSelect,
}: HomeOnboardingSheetProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const supportMessage = resolveOnboardingSupportMessage(viewModel);
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

  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previousBodyStyle = {
      position: bodyStyle.position,
      top: bodyStyle.top,
      left: bodyStyle.left,
      right: bodyStyle.right,
      width: bodyStyle.width,
      overflow: bodyStyle.overflow,
    };
    const previousHtmlOverflow = htmlStyle.overflow;

    htmlStyle.overflow = 'hidden';
    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = '0';
    bodyStyle.right = '0';
    bodyStyle.width = '100%';
    bodyStyle.overflow = 'hidden';

    return () => {
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.position = previousBodyStyle.position;
      bodyStyle.top = previousBodyStyle.top;
      bodyStyle.left = previousBodyStyle.left;
      bodyStyle.right = previousBodyStyle.right;
      bodyStyle.width = previousBodyStyle.width;
      bodyStyle.overflow = previousBodyStyle.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-120 flex items-end justify-center overflow-hidden overscroll-none bg-slate-950/35 px-0 pb-0 pt-4 sm:px-4 sm:pb-4 md:items-center md:py-4">
      <motion.section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-onboarding-title"
        aria-describedby="home-onboarding-description"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.98 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : undefined}
        className="flex h-[min(560px,calc(100dvh-1rem))] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:h-[min(640px,calc(100dvh-2rem))] sm:rounded-3xl"
      >
        <div className="shrink-0 bg-linear-to-br from-blue-50 to-cyan-50 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold text-blue-700">이용 안내</p>
                <h2
                  id="home-onboarding-title"
                  className="text-lg font-extrabold text-(--knu-text-primary)"
                >
                  {supportMessage.title}
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
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
          <div
            id="home-onboarding-description"
            className="flex items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="space-y-1">
              {supportMessage.description.split('\n').map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </span>
          </div>

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

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-(--knu-border) bg-white p-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className="mb-3 text-xs leading-relaxed text-(--knu-text-tertiary)">
            자동 안내만 숨겨요. 필요하면 홈에서 다시 열 수 있어요.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onDismissForToday}
              className="min-h-11 rounded-xl border border-(--knu-border) bg-white px-4 text-sm font-bold text-(--knu-text-secondary) transition-colors hover:bg-(--knu-background-alt)"
            >
              오늘 하루 보지 않기
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

function resolveOnboardingSupportMessage(
  viewModel: HomeDashboardViewModel,
): OnboardingSupportMessage {
  if (!viewModel.isCampusOperated) {
    return {
      title: '운영이 열리면 알려드릴게요',
      description: '현재 캠퍼스는 운영 준비 중이에요.\n운영이 열리면 홈에서 다시 안내할게요.',
    };
  }

  if (!viewModel.hasCurrentSeason) {
    const hasLastSeason = viewModel.seasonSummary.lastSeason !== null;

    return {
      title: '시즌 전 이용 안내',
      description: hasLastSeason
        ? '지금은 내 정보와 이전 기록을 확인할 수 있어요.\n시즌이 열리면 프로필 작성과 시즌 참여 신청을 홈에서 안내할게요.'
        : '지금은 내 정보를 확인할 수 있어요.\n시즌이 열리면 프로필 작성과 시즌 참여 신청을 홈에서 안내할게요.',
    };
  }

  if (!viewModel.preparation.registrationReady) {
    return {
      title: '시즌 참여 신청까지 차례대로 준비해요',
      description:
        '생활패턴과 건물 선택을 마치면 시즌 참여 신청을 마무리할 수 있어요.\n안내를 닫아도 홈의 준비 체크리스트에서 다음 행동을 계속 확인할 수 있어요.',
    };
  }

  return {
    title: '서비스 시작 전 알아두기',
    description:
      '지금 이용할 수 있는 기능만 보여드려요.\n안내를 닫아도 홈의 준비 체크리스트에서 다음 행동을 계속 확인할 수 있어요.',
  };
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
  if (!viewModel.isCampusOperated) {
    return [
      {
        label: '내 정보 확인',
        description: '운영 전에는 계정 정보와 기본 안내를 확인할 수 있어요.',
        icon: UserRound,
        onClick: () => {
          onClose();
          onNavigate('profile');
        },
      },
    ];
  }

  if (!viewModel.hasCurrentSeason) {
    const hasLastSeason = viewModel.seasonSummary.lastSeason !== null;

    if (!hasLastSeason) {
      return [
        {
          label: '내 정보 확인',
          description: '프로필 탭에서 닉네임과 학교 정보를 확인해요.',
          icon: UserRound,
          onClick: () => {
            onClose();
            onNavigate('profile');
          },
        },
      ];
    }

    return [
      {
        label: '내 정보와 이전 프로필 확인',
        description: '프로필 탭에서 내 정보와 지난 시즌 프로필을 확인해요.',
        icon: UserRound,
        onClick: () => {
          onClose();
          onNavigate('profile');
        },
      },
      {
        label: '이전 시즌 활동 보기',
        description: '매칭 현황에서 지난 시즌 요청과 결과를 확인해요.',
        icon: CheckCircle2,
        onClick: () => {
          onClose();
          onNavigate('matching', { section: 'past' });
        },
      },
    ];
  }

  if (!viewModel.preparation.hasSeasonProfile) {
    return [
      {
        label: '시즌 프로필 먼저 입력',
        description: '생활패턴과 원하는 조건을 입력해요.',
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
        description: '건물을 선택하면 같은 건물 후보를 볼 수 있어요.',
        icon: Building2,
        onClick: () => {
          onClose();
          onOpenBuildingSelect?.();
        },
      },
      {
        label: '프로필 다시 확인',
        description: '신청 전 정보를 한 번 더 확인해요.',
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
        description: '같은 건물 후보를 확인해요.',
        icon: Search,
        onClick: () => {
          onClose();
          onNavigate('list');
        },
      },
      {
        label: '매칭 현황 확인',
        description: '요청과 확정 결과를 확인해요.',
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
      description: '가능한 다음 행동을 확인해요.',
      icon: UserRound,
      onClick: () => {
        onClose();
        onNavigate('profile');
      },
    },
  ];
}
