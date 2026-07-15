import type { StoryObj } from '@storybook/nextjs-vite';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import { LegacyMatchingTabBaseline } from './legacy/LegacyMatchingTabBaseline';
import { MATCHING_BASELINE_NOW, type MatchingTabStoryScenario } from './matching-story-scenarios';

export const MATCHING_TAB_BASELINE_DESCRIPTION =
  '이 story는 리디자인 또는 BFF 연결 전 legacy MatchingTab의 현재 props 기반 렌더링을 동결합니다. fixture는 API contract의 대체물이 아니며, legacy 동작과 정책의 차이는 `BASELINE.md`에 기록합니다.';

interface MatchingTabStorySurfaceProps {
  scenario: MatchingTabStoryScenario;
}

export function MatchingTabStorySurface({ scenario }: MatchingTabStorySurfaceProps) {
  return (
    <SeasonProvider value={scenario.seasonContext}>
      <div
        data-testid="matching-tab-story-surface"
        className="min-h-screen bg-(--knu-background-alt) py-4"
      >
        <LegacyMatchingTabBaseline
          user={scenario.user}
          matchRequests={scenario.matchRequests}
          activeMatch={scenario.activeMatch}
          profiles={scenario.profiles}
          pastSeasons={scenario.pastSeasons}
          onCancelRequest={() => undefined}
          onAcceptRequest={() => undefined}
          onRejectRequest={() => undefined}
          onConfirmMatch={() => undefined}
          onRevokeConfirmMatch={() => undefined}
          onEndConversation={() => undefined}
          onEndMatch={() => undefined}
          onNavigate={() => undefined}
          initialSection={scenario.initialSection}
          initialRequestTab={scenario.initialRequestTab}
        />
      </div>
    </SeasonProvider>
  );
}

export type MatchingTabStory = StoryObj<typeof MatchingTabStorySurface>;

export function createMatchingStory(scenario: MatchingTabStoryScenario): MatchingTabStory {
  return {
    name: scenario.title,
    args: { scenario },
    parameters: {
      docs: {
        description: {
          story: `${scenario.description}\n\n고정 기준 시각: ${MATCHING_BASELINE_NOW}\n\nManual viewport hint: ${scenario.viewportHint}`,
        },
      },
      matchingBaseline: {
        now: MATCHING_BASELINE_NOW,
      },
    },
  };
}
