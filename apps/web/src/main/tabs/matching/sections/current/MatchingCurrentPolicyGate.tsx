import type { MatchCapabilityReason, MatchOverviewResponse } from '@repo/shared/match/contract';
import type { LucideIcon } from 'lucide-react';
import { CalendarClock, CircleUserRound, Handshake, ShieldAlert } from 'lucide-react';
import { PairMatchingEmptyState } from '../../components/pair/PairMatchingEmptyState';
import { matchCapabilityReasonCopy } from '../../model/matching-action-capability';
import type { MatchingNavigationIntent } from '../../model/matching-navigation-intent';

type MatchingCurrentGate =
  | { readonly kind: 'off-season'; readonly hasHistory: boolean }
  | { readonly kind: 'season-open' }
  | {
      readonly kind: 'capability';
      readonly reason: MatchCapabilityReason;
      readonly seasonState: MatchOverviewResponse['season']['state'];
      readonly hasHistory: boolean;
    }
  | {
      readonly kind: 'deregistered';
      readonly seasonState: MatchOverviewResponse['season']['state'];
      readonly hasHistory: boolean;
    };

interface GatePresentation {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly lines: readonly string[];
  readonly tone: 'blue' | 'cyan' | 'gray';
  readonly action?: {
    readonly label: string;
    readonly intent: MatchingNavigationIntent;
  };
}

export function MatchingCurrentPolicyGate({
  gate,
  onNavigate,
}: {
  readonly gate: MatchingCurrentGate;
  readonly onNavigate?: (intent: MatchingNavigationIntent) => void;
}) {
  const presentation = toGatePresentation(gate);
  const action = presentation.action;
  return (
    <section data-testid="matching-current-policy-gate">
      <PairMatchingEmptyState
        icon={presentation.icon}
        title={presentation.title}
        description={
          <>
            {presentation.lines.map((line, index) => (
              <span key={line} className={index === 0 ? 'block' : 'mt-1 block'}>
                {line}
              </span>
            ))}
          </>
        }
        tone={presentation.tone}
        action={
          action && onNavigate
            ? {
                label: action.label,
                onClick: () => onNavigate(action.intent),
              }
            : undefined
        }
      />
    </section>
  );
}

function toGatePresentation(gate: MatchingCurrentGate): GatePresentation {
  switch (gate.kind) {
    case 'off-season':
      return {
        icon: Handshake,
        title: '현재는 비시즌입니다',
        lines: ['새 요청과 응답은 다음 시즌에 열려요.', '이전 시즌 기록은 확인할 수 있어요.'],
        tone: 'blue',
        action: gate.hasHistory ? { label: '지난 매칭 기록 보기', intent: 'history' } : undefined,
      };
    case 'season-open':
      return {
        icon: CalendarClock,
        title: '시즌 매칭을 기다리고 있어요',
        lines: ['시즌 등록을 완료해 주세요.', '매칭 요청은 시즌 매칭 기간에 열려요.'],
        tone: 'cyan',
        action: { label: '시즌 등록 확인하기', intent: 'home' },
      };
    case 'capability':
      return capabilityGatePresentation(gate);
    case 'deregistered':
      return deregisteredGatePresentation(gate);
  }
}

function capabilityGatePresentation(
  gate: Extract<MatchingCurrentGate, { kind: 'capability' }>,
): GatePresentation {
  const description = matchCapabilityReasonCopy(gate.reason);
  switch (gate.reason) {
    case 'VIEWER_NOT_REGISTERED':
      if (gate.seasonState === 'SEASON_POST_MATCH') {
        return {
          icon: CalendarClock,
          title: '이번 시즌 매칭이 종료됐어요',
          lines: ['이전 시즌 이력은 지난 기록에서 확인할 수 있어요.'],
          tone: 'gray',
          action: gate.hasHistory ? { label: '지난 매칭 기록 보기', intent: 'history' } : undefined,
        };
      }
      return {
        icon: CircleUserRound,
        title: '시즌 등록이 필요해요',
        lines: [description, '등록을 마치면 매칭 요청이 열려요.'],
        tone: 'cyan',
        action: { label: '시즌 등록 확인하기', intent: 'home' },
      };
    case 'VIEWER_DEREGISTERED':
      return deregisteredGatePresentation({
        kind: 'deregistered',
        seasonState: gate.seasonState,
        hasHistory: gate.hasHistory,
      });
    case 'CAMPUS_NOT_OPERATED':
    case 'SAFETY_OR_VISIBILITY_RESTRICTED':
      return {
        icon: ShieldAlert,
        title: '현재 매칭을 이용할 수 없어요',
        lines: [description],
        tone: 'gray',
      };
    case 'SEASON_NOT_ACTIONABLE':
      return {
        icon: CalendarClock,
        title: '현재 시즌에는 매칭이 열리지 않아요',
        lines: [description, '이전 시즌 기록은 지난 기록에서 확인할 수 있어요.'],
        tone: 'gray',
      };
  }
}

function deregisteredGatePresentation(
  gate: Extract<MatchingCurrentGate, { kind: 'deregistered' }>,
): GatePresentation {
  const isOpen = gate.seasonState === 'SEASON_OPEN';
  return {
    icon: CircleUserRound,
    title: '시즌 참여를 취소했어요',
    lines: isOpen
      ? ['이번 시즌 매칭에 참여하지 않아요.', '이전 시즌 기록은 지난 기록에서 확인해요.']
      : ['진행 중이던 요청은 종료됐어요.', '이번 시즌 활동 이력은 확인할 수 있어요.'],
    tone: 'gray',
    action: undefined,
  };
}
