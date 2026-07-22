import { matchCapabilityReasonCopy } from './matching-action-capability';
import type { MatchingShellConsistency } from './matching-shell-consistency';
import type { MatchingViewState } from './matching-view-model';

export type MatchingShellTone = 'neutral' | 'progress' | 'action' | 'success' | 'caution';

export interface MatchingShellHeroView {
  readonly tone: MatchingShellTone;
  readonly eyebrow: string;
  readonly statusLabel: string;
  readonly title: string;
  readonly description: string;
}

export interface MatchingContextRailView {
  readonly tone: MatchingShellTone;
  readonly label: string;
  readonly heading: string;
  readonly facts: readonly string[];
  readonly flowMode?: 'season-closed';
}

export interface MatchingShellPresentation {
  readonly hero: MatchingShellHeroView;
  readonly rail: MatchingContextRailView;
}

const PAIR_ONLY_FACT = '현재 학생 대상 서비스는 2인 매칭만 지원해요.';
const FRESHNESS_FACT = '표시되는 상태와 제한 사유는 서버에서 확인한 최신 정보를 따라요.';

export function toMatchingShellPresentation(input: {
  readonly state: MatchingViewState;
  readonly consistency?: MatchingShellConsistency | null;
}): MatchingShellPresentation {
  if (input.consistency?.kind === 'transitioning') {
    return refreshPresentation();
  }
  if (input.consistency?.kind === 'mismatch') {
    return refreshPresentation();
  }

  switch (input.state.kind) {
    case 'loading':
      return {
        hero: {
          tone: 'neutral',
          eyebrow: '매칭 현황',
          statusLabel: '상태 확인 중',
          title: '매칭 정보를 준비하고 있어요',
          description: '현재 시즌과 요청 상태를 안전하게 확인하고 있어요.',
        },
        rail: {
          tone: 'neutral',
          label: '안내',
          heading: '최신 상태를 확인하고 있어요',
          facts: [FRESHNESS_FACT, PAIR_ONLY_FACT],
        },
      };
    case 'error':
      return {
        hero: {
          tone: 'caution',
          eyebrow: '매칭 현황',
          statusLabel: '다시 확인',
          title: '매칭 정보를 다시 확인해주세요',
          description: '연결 상태를 확인한 뒤 다시 시도할 수 있어요.',
        },
        rail: {
          tone: 'caution',
          label: '연결 안내',
          heading: '잠시 후 다시 시도할 수 있어요',
          facts: ['현재 화면에서 다시 시도하면 최신 매칭 정보를 확인해요.', PAIR_ONLY_FACT],
        },
      };
    case 'unavailable':
      return {
        hero: {
          tone: 'neutral',
          eyebrow: '매칭 현황',
          statusLabel: '이용 조건 확인',
          title: '현재 매칭 이용 안내',
          description: matchCapabilityReasonCopy(input.state.reason),
        },
        rail: {
          tone: 'neutral',
          label: '이용 안내',
          heading: '시즌 조건을 확인해주세요',
          facts: [FRESHNESS_FACT, PAIR_ONLY_FACT],
        },
      };
    case 'deregistered':
      return {
        hero: {
          tone: 'neutral',
          eyebrow: '현재 시즌',
          statusLabel: '참여 종료',
          title: '이번 시즌 참여를 취소했어요',
          description:
            input.state.seasonState === 'SEASON_OPEN'
              ? '새 매칭에는 참여하지 않으며, 이전 시즌 이력은 계속 확인할 수 있어요.'
              : '진행했던 요청은 종료됐으며, 이번 시즌 활동 이력은 계속 확인할 수 있어요.',
        },
        rail: {
          tone: 'neutral',
          label: '참여 안내',
          heading: '읽기 전용으로 이력을 확인해요',
          facts: [historyFact(input.state.historySummary.seasons), PAIR_ONLY_FACT],
        },
      };
    case 'off-season':
      return {
        hero: {
          tone: 'neutral',
          eyebrow: '현재 시즌',
          statusLabel: '비시즌',
          title: '다음 매칭 시즌을 준비하고 있어요',
          description: '현재는 새 매칭 요청을 열지 않으며, 지난 결과는 기록에서 확인할 수 있어요.',
        },
        rail: {
          tone: 'neutral',
          label: '기록 안내',
          heading: '지난 결과는 계속 확인할 수 있어요',
          facts: [historyFact(input.state.historySummary.seasons), PAIR_ONLY_FACT],
          flowMode: 'season-closed',
        },
      };
    case 'season-open':
      return {
        hero: {
          tone: 'progress',
          eyebrow: '현재 시즌',
          statusLabel: '시즌 준비',
          title: '시즌 등록 후 매칭 기간을 기다려주세요',
          description: '이전 시즌 이력은 확인할 수 있고, 새 매칭 요청은 매칭 기간에 열려요.',
        },
        rail: {
          tone: 'progress',
          label: '시즌 안내',
          heading: '요청은 매칭 기간에 열려요',
          facts: [historyFact(input.state.historySummary.seasons), PAIR_ONLY_FACT],
        },
      };
    case 'season-matching': {
      const hasActiveMatch = input.state.current.activeMatch !== null;
      const roomSelectionFact = input.state.current.roomSelectionDate
        ? `매칭 종료 기준일은 ${input.state.current.roomSelectionDate}이에요.`
        : FRESHNESS_FACT;
      return {
        hero: {
          tone: 'action',
          eyebrow: '현재 시즌',
          statusLabel: '매칭 진행 중',
          title: hasActiveMatch
            ? '확정된 룸메이트와 요청을 확인하세요'
            : '받은 요청부터 확인해보세요',
          description: hasActiveMatch
            ? '확정 관계와 남은 요청은 서버에서 확인한 최신 상태를 기준으로 안내해요.'
            : `받은 요청 ${input.state.current.receivedPendingCount}건을 먼저 확인할 수 있어요.`,
        },
        rail: {
          tone: 'action',
          label: '현재 매칭 안내',
          heading: hasActiveMatch ? '확정 관계를 확인할 수 있어요' : '요청을 확인할 수 있어요',
          facts: [roomSelectionFact, PAIR_ONLY_FACT],
        },
      };
    }
    case 'season-post-match':
      return {
        hero: {
          tone: 'success',
          eyebrow: '현재 시즌',
          statusLabel: '시즌 결과',
          title: '이번 시즌 결과를 확인하세요',
          description: input.state.activeMatch
            ? '확정된 룸메이트 결과를 확인할 수 있어요. 새로운 요청이나 매칭 해제는 열리지 않아요.'
            : '이번 시즌의 새 요청은 종료됐어요. 지난 결과는 기록에서 확인할 수 있어요.',
        },
        rail: {
          tone: 'success',
          label: '결과 확인',
          heading: '현재는 결과 확인 기간이에요',
          facts: [historyFact(input.state.historySummary.seasons), PAIR_ONLY_FACT],
        },
      };
  }
}

function refreshPresentation(): MatchingShellPresentation {
  return {
    hero: {
      tone: 'caution',
      eyebrow: '매칭 현황',
      statusLabel: '상태 재확인',
      title: '매칭 상태를 다시 확인하고 있어요',
      description: '새로운 작업을 열기 전에 최신 시즌 상태를 확인하고 있어요.',
    },
    rail: {
      tone: 'caution',
      label: '상태 안내',
      heading: '최신 정보를 다시 확인해주세요',
      facts: ['최신 시즌 정보를 다시 확인한 뒤 현재 화면을 안내할게요.', PAIR_ONLY_FACT],
    },
  };
}

function historyFact(seasons: number): string {
  return seasons > 0
    ? `확인 가능한 지난 시즌 기록이 ${seasons}개 있어요.`
    : '확인 가능한 지난 시즌 기록이 아직 없어요.';
}
