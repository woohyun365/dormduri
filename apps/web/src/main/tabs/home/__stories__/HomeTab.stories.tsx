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
      onDeregisterSeasonParticipation={async () => undefined}
      {...(scenario.renderedAt ? { renderedAtOverride: scenario.renderedAt } : {})}
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

export const OffSeasonNextSeason: Story = {
  name: 'Off season + next Season',
  args: { scenario: homeStoryScenarios.offSeasonNextSeason },
  parameters: {
    docs: {
      description: {
        story: homeStoryScenarios.offSeasonNextSeason.description,
      },
    },
  },
};
export const OffSeasonNoNextSeason: Story = {
  name: 'Off Season + no next Season',
  args: { scenario: homeStoryScenarios.offSeasonNoNextSeason },
  parameters: {
    docs: {
      description: {
        story: homeStoryScenarios.offSeasonNoNextSeason.description,
      },
    },
  },
};
export const OffSeasonNextSeasonNoServiceHistory = createStory(
  homeStoryScenarios.offSeasonNextSeasonNoServiceHistory,
);
export const OffSeasonNextSeasonNoUserHistory = createStory(
  homeStoryScenarios.offSeasonNextSeasonNoUserHistory,
);
export const OffSeasonNextSeasonUserMatchedHistory = createStory(
  homeStoryScenarios.offSeasonNextSeasonUserMatchedHistory,
);
export const OffSeasonNoNextSeasonNoServiceHistory = createStory(
  homeStoryScenarios.offSeasonNoNextSeasonNoServiceHistory,
);
export const SeasonOpenProfileAndDormitoryRequired = createStory(
  homeStoryScenarios.seasonOpenProfileAndDormitoryRequired,
);
export const SeasonOpenDormitoryRequired = createStory(
  homeStoryScenarios.seasonOpenDormitoryRequired,
);
export const SeasonOpenProfileRequired = createStory(homeStoryScenarios.seasonOpenProfileRequired);
export const SeasonOpenRegistrationReady = createStory(
  homeStoryScenarios.seasonOpenRegistrationReady,
);
export const SeasonOpenRegisteredPreview = createStory(
  homeStoryScenarios.seasonOpenRegisteredPreview,
);
export const SeasonOpenDeregistered = createStory(homeStoryScenarios.seasonOpenDeregistered);
export const SeasonOpenNoMatchingSeason = createStory(
  homeStoryScenarios.seasonOpenNoMatchingSeason,
);
export const SeasonOpenNoOperatedDormitoriesProfileIncomplete = createStory(
  homeStoryScenarios.seasonOpenNoOperatedDormitoriesProfileIncomplete,
);
export const SeasonOpenNoOperatedDormitoriesProfileComplete = createStory(
  homeStoryScenarios.seasonOpenNoOperatedDormitoriesProfileComplete,
);
export const SeasonMatchingProfileAndDormitoryRequired = createStory(
  homeStoryScenarios.seasonMatchingProfileAndDormitoryRequired,
);
export const SeasonMatchingProfileRequired = createStory(
  homeStoryScenarios.seasonMatchingProfileRequired,
);
export const SeasonMatchingDormitoryRequired = createStory(
  homeStoryScenarios.seasonMatchingDormitoryRequired,
);
export const SeasonMatchingRegistrationReady = createStory(
  homeStoryScenarios.seasonMatchingRegistrationReady,
);
export const SeasonMatchingRegisteredNoActivity = createStory(
  homeStoryScenarios.seasonMatchingRegisteredNoActivity,
);
export const SeasonMatchingRegisteredProgress40 = createStory(
  homeStoryScenarios.seasonMatchingRegisteredProgress40,
);
export const SeasonMatchingRegisteredProgress75 = createStory(
  homeStoryScenarios.seasonMatchingRegisteredProgress75,
);
export const SeasonMatchingRegisteredProgress92 = createStory(
  homeStoryScenarios.seasonMatchingRegisteredProgress92,
);
export const SeasonMatchingDeregistered = createStory(
  homeStoryScenarios.seasonMatchingDeregistered,
);
export const SeasonMatchingUnmatched = createStory(homeStoryScenarios.seasonMatchingUnmatched);
export const SeasonMatchingRegisteredS1R0C1 = createStory(
  homeStoryScenarios.seasonMatchingRegisteredS1R0C1,
);
export const SeasonMatchingRegisteredS1R1C1 = createStory(
  homeStoryScenarios.seasonMatchingRegisteredS1R1C1,
);
export const SeasonMatchingActiveMatch = createStory(homeStoryScenarios.seasonMatchingActiveMatch);
export const SeasonMatchingActiveMatchCounterpartCancelRequest = createStory(
  homeStoryScenarios.seasonMatchingActiveMatchCounterpartCancelRequest,
);
export const SeasonMatchingActiveMatchSelfCancelRequest = createStory(
  homeStoryScenarios.seasonMatchingActiveMatchSelfCancelRequest,
);
export const PostMatchNotRegistered = createStory(homeStoryScenarios.postMatchNotRegistered);
export const PostMatchDeregistered = createStory(homeStoryScenarios.postMatchDeregistered);
export const PostMatchMatched = createStory(homeStoryScenarios.postMatchMatched);
export const PostMatchUnmatched = createStory(homeStoryScenarios.postMatchUnmatched);
export const PostMatchRegisteredNotMatched = createStory(
  homeStoryScenarios.postMatchRegisteredNotMatched,
);
export const PostMatchUserHistory = createStory(homeStoryScenarios.postMatchUserHistory);
export const PostMatchRegistrationUnavailable = createStory(
  homeStoryScenarios.postMatchRegistrationUnavailable,
);
export const SeasonMatchingRegistrationUnavailable = createStory(
  homeStoryScenarios.seasonMatchingRegistrationUnavailable,
);
export const NonOperatedCampus = createStory(homeStoryScenarios.nonOperatedCampus);
export const LoadingSkeleton: Story = {
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

export const ErrorRecovery: Story = {
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
