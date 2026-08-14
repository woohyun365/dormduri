import { useEffect, useRef } from 'react';
import type { StoryObj } from '@storybook/nextjs-vite';
import type { RefObject } from 'react';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import RoommateListTab from '../RoommateListTab';
import { useRoommateStoryApiFixtures } from './roommate-story-api-fixtures';
import type { RoommateStoryScenario } from './roommate-story-scenarios';

interface RoommateListTabStorySurfaceProps {
  scenario: RoommateStoryScenario;
}

export function RoommateListTabStorySurface({ scenario }: RoommateListTabStorySurfaceProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useRoommateStoryApiFixtures(scenario);
  useRoommateStoryAutoOpen(scenario, rootRef);

  return (
    <SeasonProvider value={scenario.seasonContext}>
      <div className="min-h-screen bg-(--knu-background-alt)">
        <div ref={rootRef} className="min-h-screen w-full">
          <RoommateListTab
            user={scenario.viewer}
            searchEntryAllowed={scenario.searchEntryAllowed ?? true}
            searchClosedMessage={scenario.searchClosedMessage}
            sameDormitoryRestrictedEmptyState={scenario.sameDormitoryRestrictedEmptyState}
            onNavigate={() => undefined}
          />
        </div>
      </div>
    </SeasonProvider>
  );
}

export function createRoommateStory(scenario: RoommateStoryScenario) {
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
  } satisfies StoryObj<typeof RoommateListTabStorySurface>;
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

  if (autoOpen === 'bookmark-toggle') {
    await clickButton(root, /관심 목록 저장|관심 목록 해제/u, isCancelled);
    return;
  }

  await clickButton(root, /프로필 열람하기/u, isCancelled);

  if (autoOpen === 'detail') return;

  if (autoOpen.startsWith('match-request')) {
    await clickButton(root, /^매칭 요청 보내기$/u, isCancelled, 'first');
    if (autoOpen === 'match-request-submit') {
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
    if (autoOpen === 'report-submit' || autoOpen === 'report-optional-block-submit') {
      await prepareReportDialog(isCancelled, {
        optionalBlock: autoOpen === 'report-optional-block-submit',
      });
      await clickButton(document, /^신고 접수$/u, isCancelled, 'last');
    }
  }
}

async function prepareReportDialog(
  isCancelled: () => boolean,
  options: { readonly optionalBlock: boolean },
) {
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
  const optionalBlockCheckbox = checkboxes[0];
  const disclaimerCheckbox = checkboxes.at(-1);

  if (options.optionalBlock && optionalBlockCheckbox && !optionalBlockCheckbox.checked) {
    optionalBlockCheckbox.click();
  }
  if (disclaimerCheckbox && !disclaimerCheckbox.checked) {
    disclaimerCheckbox.click();
  }
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
