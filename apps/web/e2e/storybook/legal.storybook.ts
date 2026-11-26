import { expect, test, type Locator, type Page } from '@playwright/test';
import { sectionKindSample } from '@/screens/legal/__stories__/sectionKindSample';
import { legalScreenCopy } from '@/screens/legal/model/legalScreenCopy';

// Computed style checks on the Legal section kind stories (G-LU4): the heading levels and the callout
// labels must not rely on color or position alone. No class name or DOM shape is pinned.
const STORIES = ['legal-page--privacy-section-kinds', 'legal-page--terms-section-kinds'];

async function openStory(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`);
  await expect(page.locator('body')).toHaveClass(/sb-show-main/);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function textStyle(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { size: Number.parseFloat(style.fontSize), weight: Number(style.fontWeight) };
  });
}

const headings = sectionKindSample.sections.filter((section) => section.type === 'heading');
const paragraph = sectionKindSample.sections.find((section) => section.type === 'paragraph');
const callouts = sectionKindSample.sections.filter((section) => section.type === 'callout');

for (const id of STORIES) {
  test.describe(id, () => {
    test('sets every heading level and callout label apart from body text (G-LU4)', async ({
      page,
    }) => {
      await openStory(page, id);
      if (!paragraph) throw new Error('the section kind sample has no paragraph');
      const body = await textStyle(page.getByText(paragraph.text, { exact: true }));

      expect(new Set(headings.map((heading) => heading.level))).toEqual(new Set([2, 3, 4]));
      for (const heading of headings) {
        const style = await textStyle(
          page.getByRole('heading', { level: heading.level, name: heading.text, exact: true }),
        );
        expect(
          style.size > body.size || style.weight > body.weight,
          `h${heading.level} ${JSON.stringify(style)} vs body ${JSON.stringify(body)}`,
        ).toBe(true);
      }

      expect(callouts.map((callout) => callout.tone).sort()).toEqual(['INFO', 'WARNING']);
      for (const callout of callouts) {
        const note = page.getByRole('note').filter({ hasText: callout.text });
        const label = note.getByText(legalScreenCopy.noticeLabel[callout.tone], { exact: true });
        expect((await textStyle(label)).weight, callout.tone).toBeGreaterThan(body.weight);
      }
    });
  });
}

// The header's keyboard order follows what is seen, row by row and left to right, at every width
// (WCAG 2.4.3, 1.3.2): CSS must not draw the controls in another order than the page has them.
test('moves the keyboard through the header in the order it is seen', async ({ page }) => {
  await openStory(page, 'legal-page--privacy');
  const header = page.getByRole('banner');
  const controls = header.locator('a, button');
  const count = await controls.count();
  expect(count).toBeGreaterThan(2);

  const focused: { name: string; x: number; y: number }[] = [];
  for (let step = 0; step < count; step += 1) {
    await page.keyboard.press('Tab');
    focused.push(
      await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const box = element.getBoundingClientRect();
        return {
          name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
          x: box.x,
          y: box.y,
        };
      }),
    );
  }
  const seen = [...focused].sort((a, b) => (Math.abs(a.y - b.y) > 8 ? a.y - b.y : a.x - b.x));
  expect(focused.map((control) => control.name)).toEqual(seen.map((control) => control.name));
});
