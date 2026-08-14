import type { StoryObj } from '@storybook/nextjs-vite';
import { HomeTabSkeleton } from '@/main/components/feedback/Skeleton';
import HomeTab from '../HomeTab';
import { HomeDashboardErrorState } from '../layout/HomeDashboardErrorState';
import { useHomeStoryApiFixtures } from './home-story-api-fixtures';
import { homeStoryScenarios, type HomeStoryScenario } from './home-story-scenarios';

export const HOME_TAB_STORY_DESCRIPTION =
  'DB seed나 로그인 세션 없이 HomeTab의 주요 시즌·매칭 상태를 빠르게 비교하기 위한 story-only surface입니다. 실제 통합 정합성은 full-stack Playwright smoke가 소유합니다.';

interface HomeTabStorySurfaceProps {
  scenario: HomeStoryScenario;
}

export function HomeTabStorySurface({ scenario }: HomeTabStorySurfaceProps) {
  useHomeStoryApiFixtures({
    operationsMode: scenario.operationsMode,
    profileMode: scenario.profileMode,
  });

  return (
    <HomeTab
      dashboard={scenario.dashboard}
      onNavigate={() => undefined}
      onOpenBuildingSelect={() => undefined}
      onDashboardRefresh={async () => undefined}
      onDeregisterSeasonParticipation={async () => undefined}
      {...(scenario.renderedAt ? { renderedAtOverride: scenario.renderedAt } : {})}
    />
  );
}

export type HomeTabStory = StoryObj<typeof HomeTabStorySurface>;

export function createHomeStory(scenario: HomeStoryScenario): HomeTabStory {
  return {
    name: scenario.title,
    args: { scenario },
    parameters: {
      docs: {
        description: {
          story: scenario.description,
        },
      },
    },
  };
}

export const LoadingSkeleton: HomeTabStory = {
  name: '로딩 스켈레톤',
  args: { scenario: homeStoryScenarios.offSeasonNextSeason },
  render: () => <HomeTabSkeleton />,
  parameters: {
    docs: {
      description: {
        story: '대시보드 API 응답 전 Home tab shell이 보여주는 skeleton 상태입니다.',
      },
    },
  },
};

export const ErrorRecovery: HomeTabStory = {
  name: '오류 복구',
  args: { scenario: homeStoryScenarios.offSeasonNextSeason },
  render: () => (
    <HomeDashboardErrorState
      message="일시적으로 홈 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요."
      refreshing={false}
      onRetry={async () => undefined}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: '대시보드 API/BFF 실패 시 사용자에게 safe retry copy를 보여주는 복구 상태입니다.',
      },
    },
  },
};
