import { expect, test, type Page } from '@playwright/test';
import { beforeStack, faqItems, pairSheets } from '@/screens/landing/model/landingCopy';
import { getLandingPolicyCopy } from '@/screens/landing/model/landingPolicyCopy';

// A route other than the landing keeps the app document: the default viewport (no viewport-fit=cover)
// and no background set on html or body.
async function expectAppDocument(page: Page) {
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toMatch(/viewport-fit/);
  expect(
    await page.evaluate(() => [
      document.documentElement.style.backgroundColor,
      document.body.style.backgroundColor,
    ]),
  ).toEqual(['', '']);
}

// The page scrolls smoothly (globals.css), so a keyboard focus move can still be scrolling; wait until
// it has stopped before measuring a position.
async function waitForScrollToSettle(page: Page) {
  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => window.scrollY);
        const settled = y === last;
        last = y;
        return settled;
      },
      { intervals: [100] },
    )
    .toBe(true);
}

// The landing's own copy is not pinned here (src/screens/landing/README.md, 검증): the page is found by
// landmark, link target and the policy notices' own words (the fixed disclaimers as written, the others
// read from their policy copy), and other copy is read from the content constants, so a copy change
// outside the notices keeps these tests green.
test.describe('Landing public experience', () => {
  test('공개 랜딩은 첫 화면 제목, 첫 화면 고지, 가입 행동을 렌더링한다', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const hero = page.locator('#hero');
    await expect(hero.getByText('돔두리는 학교 공식 서비스가 아닙니다.')).toBeVisible();
    await expect(hero.getByText('기숙사 배정·호실 선택을 보장하지 않습니다.')).toBeVisible();
    await expect(hero.locator('a[href="/signup"]')).toBeVisible();
    await expect(page.getByRole('banner').locator('a[href="/signup"]')).toBeVisible();
  });

  test('390×844 첫 화면은 스크롤 없이 고지 두 문장과 가입 행동을 보여 준다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const hero = page.locator('#hero');
    await expect(hero.getByText('돔두리는 학교 공식 서비스가 아닙니다.')).toBeInViewport({
      ratio: 1,
    });
    await expect(hero.getByText('기숙사 배정·호실 선택을 보장하지 않습니다.')).toBeInViewport({
      ratio: 1,
    });
    await expect(hero.locator('a[href="/signup"]')).toBeInViewport({ ratio: 1 });
  });

  test('가입·로그인 행동은 44×44px 이상이고 keyboard focus에 2px 테두리가 생긴다', async ({
    page,
  }) => {
    await page.goto('/');

    const actions = page.locator('a[href="/signup"]:visible, header a[href="/login"]:visible');
    await expect(actions.first()).toBeVisible();
    for (const action of await actions.all()) {
      const box = await action.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    const signUp = page.locator('#hero a[href="/signup"]');
    for (let presses = 0; presses < 30; presses += 1) {
      if (await signUp.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(signUp).toBeFocused();
    await expect(signUp).toHaveCSS('outline-style', 'solid');
    await expect(signUp).toHaveCSS('outline-width', '2px');
  });

  test('320px와 1440px 폭에서 가로로 넘치지 않는다', async ({ page }) => {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 1440, height: 900 },
    ]) {
      // Resizes on a blank page: resizing the loaded landing makes it fetch the hero picture at the new
      // width and the goto right after cancels that fetch; right after a fresh build, with workers in
      // parallel, the next page's load then waited on the same picture until the test timed out.
      await page.goto('about:blank');
      await page.setViewportSize(viewport);
      await page.goto('/');
      // Asks the page to scroll sideways instead of comparing scrollWidth with clientWidth: with a
      // classic scrollbar (Linux desktop) and the root's scrollbar-gutter, those two differ by the
      // gutter even without overflow, and allowing for it would hide an overflow narrower than it.
      const scrolledX = await page.evaluate(() => {
        window.scrollTo({ left: 10_000, top: 0, behavior: 'instant' });
        return window.scrollX;
      });
      expect(scrolledX, `${viewport.width}px`).toBe(0);
    }
  });

  test('첫 화면 질문 상자는 그 질문에 답하는 영역으로 이동한다', async ({ page }) => {
    // Reduced motion keeps the first question on the box and makes the move instant.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const hero = page.locator('#hero');
    await hero.getByRole('button').first().press('Enter');

    // The answering section starts at the top under a scroll margin, so a strip of the hero may stay.
    await expect(hero).not.toBeInViewport({ ratio: 0.5 });
    // Focus moves with the view, so the keyboard goes on from the answering section.
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBeTruthy();
    await expect(page.locator(`#${focusedId}`)).toBeInViewport();
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => document.getElementById('hero')?.contains(document.activeElement)),
    ).toBe(false);
  });

  test('휴대폰 폭에서 겹쳐 보기는 누른 버튼을 제자리에 두고 겹친 카드를 그 바로 위에 보여 준다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const join = page.getByRole('button', { name: pairSheets.join });
    await join.evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    const pressedAt = (await join.boundingBox())!.y;
    // Press and watch the button on every frame of the motion: it never leaves the place it was pressed.
    const largestDrift = await join.evaluate(
      (button) =>
        new Promise<number>((resolve) => {
          const start = button.getBoundingClientRect().top;
          const until = performance.now() + 1_000;
          let largest = 0;
          (button as HTMLElement).click();
          const watch = () => {
            largest = Math.max(largest, Math.abs(button.getBoundingClientRect().top - start));
            if (performance.now() < until) requestAnimationFrame(watch);
            else resolve(largest);
          };
          requestAnimationFrame(watch);
        }),
    );
    expect(largestDrift).toBeLessThanOrEqual(2);

    // The same button now parts the sheets.
    const part = page.getByRole('button', { name: pairSheets.part });
    await expect(part).toBeVisible();
    expect(Math.abs((await part.boundingBox())!.y - pressedAt)).toBeLessThanOrEqual(2);
    // The met sheets end above the button, on screen, and the gap under them is closed: before the fix
    // they went off the top and left an empty screen above the button.
    const sheetsBottom = await part.evaluate((button) => {
      const sheets = button.closest('section')!.querySelectorAll('[class*="pair-sheet-"]');
      return Math.max(...Array.from(sheets, (sheet) => sheet.getBoundingClientRect().bottom));
    });
    expect(sheetsBottom).toBeGreaterThan(0);
    expect(pressedAt - sheetsBottom).toBeLessThan(120);
  });

  test('겹쳐 보기 버튼은 24px 이상이고 keyboard로 누르면 focus가 같은 버튼에 남고 2px 테두리가 보인다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const join = page.getByRole('button', { name: pairSheets.join });
    await join.evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    const box = (await join.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);

    // Focus without a pointer and without scrolling (a keyboard user arrives the same way), so
    // focus-visible applies and the button stays where a reader sees it.
    await join.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
    await expect(join).toBeFocused();
    await expect(join).toHaveCSS('outline-style', 'solid');
    await expect(join).toHaveCSS('outline-width', '2px');

    const pressedAt = (await join.boundingBox())!.y;
    await page.keyboard.press('Enter');
    const part = page.getByRole('button', { name: pairSheets.part });
    await expect(part).toBeFocused();
    expect(Math.abs((await part.boundingBox())!.y - pressedAt)).toBeLessThanOrEqual(2);

    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: pairSheets.join })).toBeFocused();
  });

  test('무엇이 다른가요 전환 탭은 44px 높이이고 keyboard로 고르며 2px 테두리가 보인다', async ({
    page,
  }) => {
    await page.goto('/');

    const tabs = page.getByRole('group', { name: beforeStack.switchLabel }).getByRole('button');
    await expect(tabs).toHaveCount(2);
    for (const tab of await tabs.all()) {
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    const later = tabs.nth(1);
    await later.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(later).toBeFocused();
    await waitForScrollToSettle(page);
    await expect(later).toHaveCSS('outline-style', 'solid');
    await expect(later).toHaveCSS('outline-width', '2px');

    await page.keyboard.press('Enter');
    await expect(later).toHaveAttribute('aria-pressed', 'true');
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'false');
  });

  test('알아두세요와 자주 묻는 질문을 보여 준다', async ({ page }) => {
    await page.goto('/');

    const notices = page.locator('#notices');
    await notices.scrollIntoViewIfNeeded();
    await expect(notices.getByText(/학교 기숙사 시스템과 연동되지 않으며/)).toBeVisible();
    const support = getLandingPolicyCopy('support_channel_boundary');
    await expect(notices.getByText(support.copy)).toBeVisible();

    const faq = page.locator('#faq');
    const [first] = faqItems;
    await expect(faq.getByText(first.answer)).toBeHidden();
    await faq.getByText(first.question).click();
    await expect(faq.getByText(first.answer)).toBeVisible();
  });

  test('CTA links route to signup and login', async ({ page }) => {
    await page.goto('/');

    await page.locator('#hero a[href="/signup"]').click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('heading', { name: '이메일 인증' })).toBeVisible();

    await page.goto('/');
    await page.getByRole('banner').locator('a[href="/login"]').click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  });

  test('Landing은 화면 끝까지 그리고 html·body 배경을 Landing 배경으로 둔다', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /(^|,\s*)viewport-fit=cover(,|$)/,
    );
    const frameBackground = await page
      .locator('[data-palette]')
      .first()
      .evaluate((frame) => getComputedStyle(frame).backgroundColor);
    // The frame paints an opaque landing color (rgb, not a transparent or white one) for html and body to take.
    expect(frameBackground).toMatch(/^rgb\(/);
    expect(frameBackground).not.toBe('rgb(255, 255, 255)');
    await expect
      .poll(() =>
        page.evaluate(() => [
          getComputedStyle(document.documentElement).backgroundColor,
          getComputedStyle(document.body).backgroundColor,
        ]),
      )
      .toEqual([frameBackground, frameBackground]);
  });

  test('Landing에서 법적 문서로 가면 새 문서를 읽고 viewport·배경이 앱 기본값이다', async ({
    page,
  }) => {
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => document.body.style.backgroundColor)).not.toBe('');
    await page.evaluate(() => {
      (window as Window & { landingMark?: number }).landingMark = 1;
    });

    await page.getByRole('contentinfo').locator('a[href="/privacy"]').click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: /개인정보/ })).toBeVisible();

    // The footer link is a plain anchor, so the legal page is a new document, not a client move.
    expect(
      await page.evaluate(() => (window as Window & { landingMark?: number }).landingMark),
    ).toBeUndefined();
    await expectAppDocument(page);
  });

  test('법적 문서를 바로 열면 viewport·배경이 앱 기본값이다', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1, name: /개인정보/ })).toBeVisible();

    await expectAppDocument(page);
  });
});

test.describe('Landing runtime SEO boundary', () => {
  test('the tab icon is the service mark, not the school emblem', async ({ page, request }) => {
    await page.goto('/');

    const icons = page.locator('link[rel="icon"]');
    await expect(icons).toHaveCount(1);
    const href = await icons.getAttribute('href');
    expect(href).toMatch(/^\/icon\.png/);
    expect((await request.get(href!)).headers()['content-type']).toBe('image/png');
  });

  test('링크 미리보기는 이미지 절대 URL·크기·대체 글을 주고 그 이미지가 열린다', async ({
    page,
    request,
  }) => {
    await page.goto('/');

    const meta = (attribute: 'property' | 'name', key: string) =>
      page.locator(`meta[${attribute}="${key}"]`).getAttribute('content');
    const imageUrl = await meta('property', 'og:image');
    expect(imageUrl).toMatch(/^https?:\/\/[^/]+\/_next\/static\/media\/link-preview\.[\w-]+\.jpg$/);
    expect(await meta('property', 'og:image:width')).toBe('1200');
    expect(await meta('property', 'og:image:height')).toBe('630');
    expect(await meta('property', 'og:image:alt')).toBeTruthy();
    expect(await meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(await meta('name', 'twitter:image')).toBe(imageUrl);

    const image = await request.get(new URL(imageUrl!).pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/jpeg');
  });

  test('robots.txt excludes API and protected app shell routes', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.ok()).toBe(true);

    const body = await response.text();
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /main');
    expect(body).toContain('Sitemap:');
  });

  test('sitemap.xml includes public static routes and excludes private/API routes', async ({
    request,
  }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.ok()).toBe(true);

    const body = await response.text();
    expect(body).toContain('<loc>');
    expect(body).toContain('/login');
    expect(body).toContain('/signup');
    expect(body).toContain('/terms');
    expect(body).toContain('/privacy');
    expect(body).not.toContain('/api/');
    expect(body).not.toContain('/main');
    expect(body).not.toContain('/password-reset');
  });
});
