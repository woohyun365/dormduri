import { expect, test, type Page } from '@playwright/test';
import { landingCopy } from '@/screens/landing/model/landingCopy';
import { getLandingPolicyCopy } from '@/screens/landing/model/landingPolicyCopy';

// The landing with the legal revision band (Landing/Page RevisionNotice, D-LU17): the band must not
// push the first-screen notices or the sign-up action out of the first screen, widen the page or
// unstick the header, and its privacy line names the policy by law and stands out (G-LU11).
const STORY = 'landing-page--revision-notice';
// The law's name for the privacy policy (docs/policies/legal-basis.md LB-R1), pinned as written.
const PRIVACY_NAME = '개인정보 처리방침';

async function openStory(page: Page) {
  await page.goto(`/iframe.html?id=${STORY}&viewMode=story`);
  await expect(page.locator('body')).toHaveClass(/sb-show-main/);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

function band(page: Page) {
  return page.getByRole('complementary', { name: landingCopy.revisionNotice.regionLabel });
}

test.describe('Landing revision band', () => {
  test('keeps the revision band, the first-screen notices and the sign-up action in view at 390×844 (D-LU17)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openStory(page);

    const lines = band(page).getByRole('paragraph');
    await expect(lines).toHaveCount(2);
    for (const line of await lines.all()) {
      await expect(line).toBeInViewport({ ratio: 1 });
    }
    const hero = page.locator('#hero');
    for (const id of ['service_independent_notice', 'room_selection_not_guaranteed'] as const) {
      await expect(hero.getByText(getLandingPolicyCopy(id).copy)).toBeInViewport({ ratio: 1 });
    }
    await expect(hero.locator('a[href="/signup"]')).toBeInViewport({ ratio: 1 });
  });

  test('does not overflow sideways at 320px and 1440px with the revision band (D-LU17, G-LU8)', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 1440, height: 900 },
    ]) {
      // The same check as e2e/landing.spec.ts: resize on a blank page, then ask the page to scroll
      // sideways.
      await page.goto('about:blank');
      await page.setViewportSize(viewport);
      await openStory(page);
      await expect(band(page)).toBeVisible();
      const scrolledX = await page.evaluate(() => {
        window.scrollTo({ left: 10_000, top: 0, behavior: 'instant' });
        return window.scrollX;
      });
      expect(scrolledX, `${viewport.width}px`).toBe(0);
    }
  });

  test('keeps the header stuck to the top once the revision band scrolls away (D-LU17)', async ({
    page,
  }) => {
    await openStory(page);
    const bandBox = await band(page).boundingBox();
    expect(bandBox).not.toBeNull();

    await page.evaluate(
      (top) => {
        window.scrollTo({ left: 0, top, behavior: 'instant' });
      },
      Math.ceil((bandBox?.height ?? 0) + 200),
    );
    await expect.poll(async () => (await page.getByRole('banner').boundingBox())?.y).toBe(0);
    await expect(band(page)).not.toBeInViewport();
  });

  test('names the privacy line by law and sets it bolder than the terms line (G-LU11, D-LU17)', async ({
    page,
  }) => {
    await openStory(page);
    const privacy = band(page).locator('a[href^="/privacy"]');
    const terms = band(page).locator('a[href^="/terms"]');

    await expect(privacy).toHaveAccessibleName(new RegExp(PRIVACY_NAME));
    const weightOf = (link: typeof privacy) =>
      link.evaluate((element) => Number(getComputedStyle(element).fontWeight));
    expect(await weightOf(privacy)).toBeGreaterThan(await weightOf(terms));
  });
});
