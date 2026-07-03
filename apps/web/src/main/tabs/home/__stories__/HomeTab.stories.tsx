import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HomeTabSkeleton } from '@/components/Skeleton';
import HomeTab from '../HomeTab';
import { HomeDashboardErrorState } from '../components/HomeDashboardErrorState';
import { homeStoryScenarios, type HomeStoryScenario } from './home-story-scenarios';
import {
  createMatchHistoryResponse,
  createPreviousSeasonProfileResponse,
  createPublicProfileFull,
  createSeasonProfileDraftResponse,
} from '@/test/home-profile-detail-fixtures';

interface HomeTabStorySurfaceProps {
  scenario: HomeStoryScenario;
}

function HomeTabStorySurface({ scenario }: HomeTabStorySurfaceProps) {
  useHomeProfileDetailStoryApiFixtures();

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

type StoryFetchStore = {
  originalFetch: typeof fetch;
  refCount: number;
};

const HOME_PROFILE_DETAIL_STORY_FETCH_KEY = '__knuHomeProfileDetailStoryFetch__';

function useHomeProfileDetailStoryApiFixtures() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const globalStore = globalThis as typeof globalThis & {
      [HOME_PROFILE_DETAIL_STORY_FETCH_KEY]?: StoryFetchStore;
    };

    if (globalStore[HOME_PROFILE_DETAIL_STORY_FETCH_KEY]) {
      globalStore[HOME_PROFILE_DETAIL_STORY_FETCH_KEY].refCount += 1;
      return () => {
        const store = globalStore[HOME_PROFILE_DETAIL_STORY_FETCH_KEY];
        if (!store) return;
        store.refCount -= 1;
        if (store.refCount <= 0) {
          window.fetch = store.originalFetch;
          delete globalStore[HOME_PROFILE_DETAIL_STORY_FETCH_KEY];
        }
      };
    }

    const originalFetch = window.fetch.bind(window);
    globalStore[HOME_PROFILE_DETAIL_STORY_FETCH_KEY] = {
      originalFetch: window.fetch,
      refCount: 1,
    };

    window.fetch = async (input, init) => {
      const pathname = resolveStoryFetchPathname(input);

      if (pathname === '/api/seasons/current/profile') {
        return createStoryJsonResponse(
          createSeasonProfileDraftResponse({
            state: 'REGISTRATION_FINALIZED',
            draftWritable: false,
            intro: '조용한 생활을 선호하고 서로의 생활 리듬을 존중하는 룸메를 찾고 있어요.',
          }),
        );
      }

      if (pathname === '/api/seasons/previous/profile') {
        return createStoryJsonResponse(createPreviousSeasonProfileResponse());
      }

      if (pathname === '/api/matches/history') {
        return createStoryJsonResponse(createMatchHistoryResponse());
      }

      if (/^\/api\/matches\/history\/entries\/[^/]+\/counterpart-profile$/.test(pathname)) {
        return createStoryJsonResponse(
          createPublicProfileFull({
            id: 'history-counterpart-user',
            nickname: '민지',
            intro: '지난 시즌에 생활패턴이 잘 맞았던 룸메 후보예요.',
            matchScore: 91,
          }),
        );
      }

      if (/^\/api\/profiles\/[^/]+$/.test(pathname)) {
        return createStoryJsonResponse(
          createPublicProfileFull({
            id: decodeURIComponent(pathname.split('/').at(-1) ?? 'partner-user-1'),
            nickname: '민지',
            intro: '아침형 생활패턴이고, 조용한 방 분위기를 선호해요.',
            matchScore: 92,
          }),
        );
      }

      return originalFetch(input, init);
    };

    return () => {
      const store = globalStore[HOME_PROFILE_DETAIL_STORY_FETCH_KEY];
      if (!store) return;
      store.refCount -= 1;
      if (store.refCount <= 0) {
        window.fetch = store.originalFetch;
        delete globalStore[HOME_PROFILE_DETAIL_STORY_FETCH_KEY];
      }
    };
  }, []);
}

function resolveStoryFetchPathname(input: Parameters<typeof fetch>[0]): string {
  const rawUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  return new URL(rawUrl, window.location.origin).pathname;
}

function createStoryJsonResponse(json: unknown): Response {
  return new Response(JSON.stringify(json), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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
