import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Every story of the backoffice Storybook static build renders without errors or axe violations (design guide ⑨).
// No screenshot is compared and no baseline image is kept: the Owner reviews captures under .artifacts.
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type IndexEntry = {
  id: string;
  title: string;
  name: string;
  importPath: string;
  type: 'story' | 'docs';
};

const index = JSON.parse(
  readFileSync(resolve(process.cwd(), 'storybook-static/index.json'), 'utf8'),
) as { entries: Record<string, IndexEntry> };
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');

async function openStory(page: Page, id: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(`/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`);
  await expect(page.locator('body')).toHaveClass(/sb-show-main/);
  // Effects and zero-delay timers (the idle notice) run before the check.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolveFrame) => requestAnimationFrame(() => setTimeout(resolveFrame, 0)));
  });
  return errors;
}

test('the static build has stories from the app source', () => {
  expect(stories.length).toBeGreaterThan(0);
  expect(stories.filter((story) => !story.importPath.startsWith('./src/'))).toEqual([]);
});

for (const story of stories) {
  test(`${story.title} / ${story.name} renders without errors or axe violations`, async ({
    page,
  }) => {
    const errors = await openStory(page, story.id);
    const results = await new AxeBuilder({ page })
      .include('#storybook-root')
      .withTags(AXE_TAGS)
      .analyze();
    const violations = results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map((node) => node.target.join(' ')),
    }));
    test.info().annotations.push({
      type: 'axe',
      description: `violations ${results.violations.length}, incomplete ${results.incomplete.length}, passes ${results.passes.map(({ id }) => id).join(' ')}`,
    });

    expect(errors).toEqual([]);
    expect(violations).toEqual([]);
  });
}
