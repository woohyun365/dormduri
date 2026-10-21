import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// New screen layer and token sample stories in the Storybook static build. The existing stories
// are not checked here.
const CHECKED_IMPORT_PATHS = ['./src/screens/', './src/styles/tokens/'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type IndexEntry = {
  id: string;
  title: string;
  name: string;
  importPath: string;
  type: 'story' | 'docs';
  tags?: string[];
};

const index = JSON.parse(
  readFileSync(resolve(process.cwd(), 'storybook-static/index.json'), 'utf8'),
) as { entries: Record<string, IndexEntry> };
const stories = Object.values(index.entries).filter(
  (entry) =>
    entry.type === 'story' &&
    CHECKED_IMPORT_PATHS.some((prefix) => entry.importPath.startsWith(prefix)),
);

async function openStory(page: Page, id: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(`/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`);
  await expect(page.locator('body')).toHaveClass(/sb-show-main/);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  return errors;
}

test('the static build has new screen or token stories', () => {
  expect(stories.length).toBeGreaterThan(0);
});

// The preview decorator renders only knu-layer stories on the new layer background and fonts, so axe
// contrast and screenshots of a story without the tag would be judged on the legacy wrapper.
test('every checked story renders on the new layer', () => {
  expect(
    stories.filter((story) => !story.tags?.includes('knu-layer')).map((story) => story.id),
  ).toEqual([]);
});

for (const story of stories) {
  test.describe(`${story.title} / ${story.name}`, () => {
    test('renders without errors or axe violations', async ({ page }) => {
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

    if (story.tags?.includes('visual')) {
      test('matches the Linux screenshot', async ({ page }) => {
        test.skip(
          process.platform !== 'linux',
          'Screenshots are compared on Linux only; other platforms check render and axe.',
        );
        await openStory(page, story.id);
        await expect(page).toHaveScreenshot(`${story.id}.png`, {
          fullPage: true,
          animations: 'disabled',
        });
      });
    }
  });
}
