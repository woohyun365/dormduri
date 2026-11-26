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
