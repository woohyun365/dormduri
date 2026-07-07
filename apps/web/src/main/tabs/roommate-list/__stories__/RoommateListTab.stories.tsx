import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { RefObject } from 'react';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import RoommateListTab from '../RoommateListTab';
import { useRoommateStoryApiFixtures } from './roommate-story-api-fixtures';
import { roommateStoryScenarios, type RoommateStoryScenario } from './roommate-story-scenarios';

interface RoommateListTabStorySurfaceProps {
  scenario: RoommateStoryScenario;
}

function RoommateListTabStorySurface({ scenario }: RoommateListTabStorySurfaceProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useRoommateStoryApiFixtures(scenario);
  useRoommateStoryAutoOpen(scenario, rootRef);

  return (
    <SeasonProvider value={scenario.seasonContext}>
      <div className="min-h-screen bg-(--knu-background-alt) px-0 py-4 sm:px-4">
        <div
          ref={rootRef}
          className="mx-auto w-full max-w-md overflow-hidden rounded-4xl border border-(--knu-border) bg-white/80 shadow-sm lg:max-w-7xl lg:bg-white/70"
        >
          <RoommateListTab
            user={scenario.viewer}
            searchEntryAllowed={scenario.searchEntryAllowed ?? true}
            onNavigate={() => undefined}
          />
        </div>
      </div>
    </SeasonProvider>
  );
}

const meta = {
  title: 'Main/RoommateTab',
  component: RoommateListTabStorySurface,
  parameters: {
    docs: {
      description: {
        component:
          'DB seed나 로그인 세션 없이 RoommateTab의 search/bookmark/detail/action policy state를 빠르게 비교하기 위한 story-only visual workshop입니다. 실제 BFF/API/auth 통합 정합성은 targeted test와 full-stack smoke가 소유합니다.',
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
} satisfies Meta<typeof RoommateListTabStorySurface>;

export default meta;

type Story = StoryObj<typeof meta>;

function createStory(scenario: RoommateStoryScenario): Story {
  return {
    name: scenario.title,
    args: { scenario },
    parameters: {
      docs: {
        description: {
          story: `${scenario.description}\n\nManual viewport hint: ${scenario.viewportHint}.`,
        },
      },
    },
  };
}

function useRoommateStoryAutoOpen(
  scenario: RoommateStoryScenario,
  rootRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const autoOpen = scenario.autoOpen;
    if (!autoOpen || typeof window === 'undefined') return;

    let cancelled = false;
    const run = async () => {
      const root = rootRef.current ?? document.body;
      await runAutoOpenSteps(autoOpen, root, () => cancelled);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [rootRef, scenario.autoOpen, scenario.key]);
}

async function runAutoOpenSteps(
  autoOpen: NonNullable<RoommateStoryScenario['autoOpen']>,
  root: ParentNode,
  isCancelled: () => boolean,
) {
  if (autoOpen === 'filter-sheet') {
    await clickButton(root, /필터 열기/u, isCancelled);
    return;
  }

  await clickButton(root, /프로필 열람하기/u, isCancelled);

  if (autoOpen === 'detail') return;

  if (autoOpen.startsWith('match-request')) {
    await clickButton(root, /^매칭 요청 보내기$/u, isCancelled, 'first');
    if (autoOpen === 'match-request-stale-submit') {
      await clickButton(document, /^매칭 요청 보내기$/u, isCancelled, 'last');
    }
    return;
  }

  if (autoOpen.startsWith('block')) {
    await clickButton(root, /^차단하기$/u, isCancelled, 'first');
    if (autoOpen === 'block-submit') {
      await clickButton(document, /^차단하기$/u, isCancelled, 'last');
    }
    return;
  }

  if (autoOpen.startsWith('report')) {
    await clickButton(root, /^신고하기$/u, isCancelled);
    if (autoOpen === 'report-optional-block-submit') {
      await prepareReportDialog(isCancelled);
      await clickButton(document, /^신고 접수$/u, isCancelled, 'last');
    }
  }
}

async function prepareReportDialog(isCancelled: () => boolean) {
  const dialog = await waitForElement(
    () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1) ?? null,
    isCancelled,
  );
  if (!dialog) return;

  const select = dialog.querySelector<HTMLSelectElement>('#roommate-report-reason');
  if (select) {
    select.value = 'FALSE_PROFILE';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const checkboxes = [...dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  checkboxes.forEach((checkbox) => {
    if (!checkbox.checked) checkbox.click();
  });
}

async function clickButton(
  root: ParentNode,
  labelPattern: RegExp,
  isCancelled: () => boolean,
  position: 'first' | 'last' = 'first',
) {
  const button = await waitForElement(() => {
    const candidate = findButton(root, labelPattern, position);
    return candidate && !candidate.disabled ? candidate : null;
  }, isCancelled);
  if (!button) return;
  button.click();
}

function findButton(
  root: ParentNode,
  labelPattern: RegExp,
  position: 'first' | 'last',
): HTMLButtonElement | null {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')].filter((button) => {
    const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.trim();
    return labelPattern.test(label);
  });

  return position === 'last' ? (buttons.at(-1) ?? null) : (buttons[0] ?? null);
}

async function waitForElement<T extends Element>(
  resolve: () => T | null,
  isCancelled: () => boolean,
): Promise<T | null> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (isCancelled()) return null;
    const element = resolve();
    if (element) return element;
    await new Promise((done) => window.setTimeout(done, 120));
  }
  return null;
}

export const OffSeasonClosed = createStory(roommateStoryScenarios.offSeasonClosed);
export const SeasonOpenRegistered = createStory(roommateStoryScenarios.seasonOpenRegistered);
export const SeasonOpenNotRegistered = createStory(roommateStoryScenarios.seasonOpenNotRegistered);
export const SeasonOpenRegisteredEmpty = createStory(
  roommateStoryScenarios.seasonOpenRegisteredEmpty,
);
export const SeasonOpenSearchError = createStory(roommateStoryScenarios.seasonOpenSearchError);
export const SeasonOpenLoadingSkeleton = createStory(
  roommateStoryScenarios.seasonOpenLoadingSkeleton,
);
export const SeasonMatchingRegistered = createStory(
  roommateStoryScenarios.seasonMatchingRegistered,
);
export const SeasonMatchingNotRegistered = createStory(
  roommateStoryScenarios.seasonMatchingNotRegistered,
);
export const SeasonMatchingNotRegisteredEmpty = createStory(
  roommateStoryScenarios.seasonMatchingNotRegisteredEmpty,
);
export const SeasonMatchingRegisteredEmpty = createStory(
  roommateStoryScenarios.seasonMatchingRegisteredEmpty,
);
export const SeasonMatchingSearchError = createStory(
  roommateStoryScenarios.seasonMatchingSearchError,
);
export const SeasonMatchingLoadingSkeleton = createStory(
  roommateStoryScenarios.seasonMatchingLoadingSkeleton,
);
export const SeasonMatchingDetailFullCompatibility = createStory(
  roommateStoryScenarios.seasonMatchingDetailFullCompatibility,
);
export const SeasonMatchingExceptionScoreCalculationFailed = createStory(
  roommateStoryScenarios.seasonMatchingExceptionScoreCalculationFailed,
);
export const SeasonMatchingExceptionDetailUnavailable = createStory(
  roommateStoryScenarios.seasonMatchingExceptionDetailUnavailable,
);
export const SeasonMatchingExceptionAccessRecheckFailed = createStory(
  roommateStoryScenarios.seasonMatchingExceptionAccessRecheckFailed,
);
export const SeasonMatchingMatchRequestDialog = createStory(
  roommateStoryScenarios.seasonMatchingMatchRequestDialog,
);
export const SeasonMatchingMatchRequestStaleError = createStory(
  roommateStoryScenarios.seasonMatchingMatchRequestStaleError,
);
export const SeasonMatchingBlockDialog = createStory(
  roommateStoryScenarios.seasonMatchingBlockDialog,
);
export const SeasonMatchingBlockSuccessReceipt = createStory(
  roommateStoryScenarios.seasonMatchingBlockSuccessReceipt,
);
export const SeasonMatchingReportDialog = createStory(
  roommateStoryScenarios.seasonMatchingReportDialog,
);
export const SeasonMatchingReportOptionalBlockReceipt = createStory(
  roommateStoryScenarios.seasonMatchingReportOptionalBlockReceipt,
);
export const SeasonMatchingMobileBookmarkIconState = createStory(
  roommateStoryScenarios.seasonMatchingMobileBookmarkIconState,
);
export const SeasonMatchingActionPendingDisabled = createStory(
  roommateStoryScenarios.seasonMatchingActionPendingDisabled,
);
export const PostMatchCohortReview = createStory(roommateStoryScenarios.postMatchCohortReview);
