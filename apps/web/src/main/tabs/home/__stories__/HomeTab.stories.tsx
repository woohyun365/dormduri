import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HomeTabSkeleton } from '@/components/Skeleton';
import HomeTab from '../HomeTab';
import { HomeDashboardErrorState } from '../components/HomeDashboardErrorState';
import { homeStoryScenarios, type HomeStoryScenario } from './home-story-scenarios';

interface HomeTabStorySurfaceProps {
  scenario: HomeStoryScenario;
}

function HomeTabStorySurface({ scenario }: HomeTabStorySurfaceProps) {
  return (
    <HomeTab
      dashboard={scenario.dashboard}
      onNavigate={() => undefined}
      onOpenBuildingSelect={() => undefined}
      onDashboardRefresh={async () => undefined}
    />
  );
}

const meta = {
  title: 'Main/HomeTab',
  component: HomeTabStorySurface,
  parameters: {
    docs: {
      description: {
        component:
          'DB seed나 로그인 세션 없이 HomeTab의 주요 시즌·매칭 상태를 빠르게 비교하기 위한 story-only surface입니다. 실제 통합 정합성은 full-stack Playwright smoke가 소유합니다.',
      },
    },
  },
  argTypes: {
    scenario: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof HomeTabStorySurface>;

export default meta;

type Story = StoryObj<typeof meta>;

function createStory(scenario: HomeStoryScenario): Story {
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

export const OffSeason = createStory(homeStoryScenarios.offSeason);
export const NoCurrentSeason = createStory(homeStoryScenarios.noCurrentSeason);
export const NoHistoryNoCurrentSeason = createStory(homeStoryScenarios.noHistoryNoCurrentSeason);
export const SeasonOpenProfileIncomplete = createStory(
  homeStoryScenarios.seasonOpenProfileIncomplete,
);
export const SeasonOpenRegisteredAssigned = createStory(
  homeStoryScenarios.seasonOpenRegisteredAssigned,
);
export const RegistrationUnavailable = createStory(homeStoryScenarios.registrationUnavailable);
export const SeasonMatchingNoBuilding = createStory(homeStoryScenarios.matchingNoBuilding);
export const SeasonMatchingPendingReceived = createStory(
  homeStoryScenarios.matchingPendingReceived,
);
export const SeasonMatchingPendingSent = createStory(homeStoryScenarios.matchingPendingSent);
export const ActiveMatchUnreadChat = createStory(homeStoryScenarios.activeMatchUnreadChat);
export const PostMatchHistory = createStory(homeStoryScenarios.postMatchHistory);
export const NonOperatedCampus = createStory(homeStoryScenarios.nonOperatedCampus);
export const OnboardingNoticeOpen = createStory(homeStoryScenarios.onboardingNoticeOpen);
export const OnboardingNoticeDismissed = createStory(homeStoryScenarios.onboardingNoticeDismissed);

export const LoadingSkeleton: Story = {
  name: '로딩 스켈레톤',
  args: { scenario: homeStoryScenarios.offSeason },
  render: () => <HomeTabSkeleton />,
  parameters: {
    docs: {
      description: {
        story: '대시보드 API 응답 전 Home tab shell이 보여주는 skeleton 상태입니다.',
      },
    },
  },
};

export const ErrorRecovery: Story = {
  name: '오류 복구',
  args: { scenario: homeStoryScenarios.offSeason },
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
