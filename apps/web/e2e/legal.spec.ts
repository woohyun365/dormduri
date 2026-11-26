import { expect, test, type Locator, type Page } from '@playwright/test';
import { formatLegalCheckedAt } from '@/screens/legal/model/legalDocumentModel';
import { legalDocumentNames, legalScreenCopy } from '@/screens/legal/model/legalScreenCopy';
import { INTERNAL_COPY_PATTERN } from '@/screens/ui/__tests__/userCopyChecks';
import { WEB_E2E_LEGAL_CHECKED_AT } from './support/legal-last-success-fixture';

// The Web-only lane has no API, so the two documents in effect come from the last success files the global setup
// writes from the legal seed (e2e/support/legal-last-success-fixture.ts). Version addresses have no kept file. The
// published path against a running API is legal.fullstack.spec.ts. Three flows (E1~E3) and one state only the
// server answer shows (E4, the 404), then the load state cases the last success fixture brought.
const LAST_SUCCESS_NOTICE = legalScreenCopy.lastSuccessNotice;
const LAST_SUCCESS_CHECKED_AT = formatLegalCheckedAt(WEB_E2E_LEGAL_CHECKED_AT);
// The law's name for the privacy policy (docs/policies/legal-basis.md LB-R1), pinned as written.
const PRIVACY_NAME = '개인정보 처리방침';
const PRIVACY_TITLE = '돔두리 개인정보 처리방침';
const TERMS_TITLE = '돔두리 이용약관';
const LG = 1024;

function isWide(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= LG;
}

async function historyLength(page: Page): Promise<number> {
  return page.evaluate(() => window.history.length);
}

function lastSuccessStatus(page: Page): Locator {
  return page
    .getByRole('status')
    .filter({ hasText: LAST_SUCCESS_NOTICE })
    .filter({ hasText: LAST_SUCCESS_CHECKED_AT });
}

// The visible table of contents: the rail from lg, the folded list (opened first) below it.
async function openToc(page: Page): Promise<Locator> {
  if (!isWide(page)) {
    await page.locator('summary').filter({ hasText: legalScreenCopy.tocLabel }).click();
  }
  const toc = page.locator('nav:visible').filter({ has: page.locator('a[href^="#"]') });
  await expect(toc).toHaveCount(1);
  return toc;
}

async function tocIds(toc: Locator): Promise<string[]> {
  const hrefs = await toc
    .locator('a[href^="#"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  return hrefs.map((href) => decodeURIComponent(href.slice(1)));
}

// The heading is on screen, and from lg its top is below the sticky header (G-LU8).
async function expectHeadingClear(page: Page, heading: Locator) {
  await expect(heading).toBeInViewport();
  if (!isWide(page)) return;
  const header = page.getByRole('banner');
  await expect
    .poll(async () => {
      const [headingBox, headerBox] = await Promise.all([
        heading.boundingBox(),
        header.boundingBox(),
      ]);
      if (!headingBox || !headerBox) return -1;
      return Math.round(headingBox.y - (headerBox.y + headerBox.height));
    })
    .toBeGreaterThanOrEqual(0);
}

async function fontWeight(link: Locator): Promise<number> {
  return link.evaluate((element) => Number(getComputedStyle(element).fontWeight));
}

test.describe('Public legal documents without the API', () => {
  test('비로그인 사용자는 두 공개 문서를 바꿔 본 뒤 이전 화면으로 들어온 화면에 돌아간다', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('contentinfo').locator('a[href="/privacy"]').click();

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: PRIVACY_TITLE })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(lastSuccessStatus(page)).toBeVisible();
    await expect(page.locator('body')).not.toContainText(INTERNAL_COPY_PATTERN);
    await expect(page.locator('body')).not.toContainText(/privacy-\d{4}-\d{2}-\d{2}/);

    // Both documents in the header, the current one marked, the privacy policy named by law and bolder.
    const nav = page.getByRole('navigation', { name: legalScreenCopy.documentNavLabel });
    const privacy = nav.getByRole('link', { name: PRIVACY_NAME, exact: true });
    const terms = nav.getByRole('link', {
      name: legalDocumentNames.TERMS_OF_SERVICE,
      exact: true,
    });
    await expect(privacy).toHaveAttribute('aria-current', 'page');
    await expect(terms).not.toHaveAttribute('aria-current');
    expect(await fontWeight(privacy)).toBeGreaterThan(await fontWeight(terms));

    // Home only through the header logo (D-LU7).
    await expect(page.locator('a[href="/"]')).toHaveCount(1);
    const logo = page.getByRole('link', { name: legalScreenCopy.homeLabel });
    await expect(logo.getByRole('img')).toHaveCount(1);

    const length = await historyLength(page);
    await terms.click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { level: 1, name: TERMS_TITLE })).toBeVisible();
    await expect(terms).toHaveAttribute('aria-current', 'page');
    expect(await historyLength(page)).toBe(length);

    await page.getByRole('button', { name: legalScreenCopy.backLabel }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#hero')).toBeVisible();
  });

  test('목차로 조를 옮기면 방문 기록이 쌓이지 않고 그 조가 header에 가리지 않는다', async ({
    page,
  }) => {
    // Instant scrolling: the test reads where the heading ends up, not the animation.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/privacy');
    const length = await historyLength(page);
    const toc = await openToc(page);
    const ids = await tocIds(toc);
    expect(ids.length).toBeGreaterThan(4);

    // The second, the fifth and the last entry. The links carry the raw heading id (#제1조…), so they
    // are picked by position.
    const picked = [1, 4, ids.length - 1];
    const links = toc.locator('a[href^="#"]');
    for (const index of picked) {
      await links.nth(index).click();
      const heading = page.locator(`[id="${ids[index]}"]`);
      await expectHeadingClear(page, heading);
      await expect(heading).toBeFocused();
    }
    expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe(ids.at(-1));
    expect(await historyLength(page)).toBe(length);

    // An address with the article opens there too.
    await page.goto(`/privacy#${encodeURIComponent(ids[2] as string)}`);
    await expectHeadingClear(page, page.locator(`[id="${ids[2]}"]`));
  });

  test('좁은 화면은 본문 전에 접힌 목차를 열고 320px에서 표 밖으로 넘치지 않으며 인쇄하면 본문 전체가 나온다', async ({
    page,
  }) => {
    // The phone size the device guide names for the folded contents (390×844 override).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/privacy');

    const summary = page.locator('summary').filter({ hasText: legalScreenCopy.tocLabel });
    const firstBodyHeading = page.locator('main [id^="section-"]').first();
    await expect(summary).toBeVisible();
    const [summaryBox, headingBox] = await Promise.all([
      summary.boundingBox(),
      firstBodyHeading.boundingBox(),
    ]);
    expect((summaryBox?.y ?? Infinity) < (headingBox?.y ?? -Infinity)).toBe(true);
    await summary.click();
    const toc = page.getByRole('navigation', { name: legalScreenCopy.tocLabel }).filter({
      visible: true,
    });
    await expect(toc).toBeVisible();
    const ids = await tocIds(toc);

    // 320px: nothing overflows the page sideways; a table wider than the screen scrolls in its own
    // region, which takes keyboard focus while it overflows.
    await page.goto('about:blank');
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/privacy');
    const scrolledX = await page.evaluate(() => {
      window.scrollTo({ left: 10_000, top: 0, behavior: 'instant' });
      return window.scrollX;
    });
    expect(scrolledX).toBe(0);
    const regions = page.locator('main [role="region"]').filter({ has: page.locator('table') });
    expect(await regions.count()).toBeGreaterThan(0);
    await expect
      .poll(() =>
        regions.evaluateAll((elements) =>
          elements
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .map((element) => element.getAttribute('tabindex')),
        ),
      )
      .toEqual(expect.not.arrayContaining([null]));

    // Printing: no header, footer or contents, and every body heading the contents list is shown.
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('banner')).toBeHidden();
    await expect(page.getByRole('contentinfo')).toBeHidden();
    await expect(
      page.locator('summary').filter({ hasText: legalScreenCopy.tocLabel }),
    ).toBeHidden();
    await expect(page.locator('nav:visible')).toHaveCount(0);
    const bodyHeadings = page.locator('main [id^="section-"]');
    await expect(bodyHeadings).toHaveCount(ids.length);
    for (const id of ids) {
      await expect(page.locator(`[id="${id}"]`)).toBeVisible();
    }
  });

  test('형식이 틀린 판 주소는 404와 없는 판 화면을 내고 지금 판 보기가 그 문서로 간다', async ({
    page,
  }) => {
    const response = await page.goto('/terms?version=next');

    expect(response?.status()).toBe(404);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: `${legalDocumentNames.TERMS_OF_SERVICE}${legalScreenCopy.versionNotFoundTitleSuffix}`,
      }),
    ).toBeVisible();
    await expect(page.locator('[data-dormduri-legal-source]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(INTERNAL_COPY_PATTERN);

    await page.getByRole('link', { name: legalScreenCopy.viewCurrentVersionLabel }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { level: 1, name: TERMS_TITLE })).toBeVisible();
    await expect(page.locator('[data-dormduri-legal-source="last-success"]')).toHaveCount(1);
  });

  // The load state cases the last success fixture brought (legal content operations D-LC11).
  test('비로그인 사용자는 /terms에서 마지막으로 확인한 판과 확인 시각을 본다', async ({ page }) => {
    await page.goto('/terms');

    await expect(page.getByRole('heading', { level: 1, name: TERMS_TITLE })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '제1조(목적)' })).toBeVisible();
    await expect(lastSuccessStatus(page)).toBeVisible();
    await expect(page.locator('[data-dormduri-legal-source="last-success"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: legalScreenCopy.backLabel })).toBeVisible();
    await expect(
      page.getByRole('link', { name: legalScreenCopy.homeActionLabel, exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('button', { name: legalScreenCopy.printLabel })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(INTERNAL_COPY_PATTERN);
    await expect(page.locator('body')).not.toContainText(/terms-\d{4}-\d{2}-\d{2}/);
  });

  test('비로그인 사용자는 /privacy에서 마지막으로 확인한 판을 본다', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page.getByRole('heading', { level: 1, name: PRIVACY_TITLE })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '제1조(개인정보의 처리 목적)' }),
    ).toBeVisible();
    await expect(lastSuccessStatus(page)).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);

    if (isWide(page)) {
      await expect(
        page.getByRole('navigation', { name: legalScreenCopy.tocLabel }).filter({ visible: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.locator('summary').filter({ hasText: legalScreenCopy.tocLabel }),
      ).toBeVisible();
    }

    await expect(page.locator('body')).not.toContainText(INTERNAL_COPY_PATTERN);
    await expect(page.locator('body')).not.toContainText(/privacy-\d{4}-\d{2}-\d{2}/);
  });

  test('보관한 판이 없는 판 주소는 문서를 지금 표시할 수 없다고 알린다', async ({ page }) => {
    await page.goto('/privacy?version=2026-06-22');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: `${legalDocumentNames.PRIVACY_POLICY}${legalScreenCopy.unavailableTitleSuffix}`,
      }),
    ).toBeVisible();
    await expect(page.locator('[data-dormduri-legal-source]')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: legalScreenCopy.unavailableRetryLabel }),
    ).toHaveAttribute('href', '/privacy');
    await expect(
      page.getByRole('link', { name: legalScreenCopy.homeActionLabel, exact: true }),
    ).toHaveAttribute('href', '/');
  });
});
