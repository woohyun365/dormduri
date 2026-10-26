import { expect, test } from '@playwright/test';
import { faqItems } from '@/screens/landing/model/landingCopy';
import { getLandingPolicyCopy } from '@/screens/landing/model/landingPolicyCopy';

// The landing's own copy is not pinned here (src/screens/landing/README.md, 검증): the page is found by
// landmark, link target and the policy notices' own words (the fixed disclaimers as written, the others
// read from their policy copy), and other copy is read from the content constants, so a copy change
// outside the notices keeps these tests green.
test.describe('Landing public experience', () => {
  test('공개 랜딩은 첫 화면 제목, 첫 화면 고지, 가입 행동을 렌더링한다', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const hero = page.locator('#hero');
    await expect(hero.getByText('KNU 룸메는 학교 공식 서비스가 아닙니다.')).toBeVisible();
    await expect(hero.getByText('기숙사 배정·호실 선택을 보장하지 않습니다.')).toBeVisible();
    await expect(hero.locator('a[href="/signup"]')).toBeVisible();
    await expect(page.getByRole('banner').locator('a[href="/signup"]')).toBeVisible();
  });

  test('390×844 첫 화면은 스크롤 없이 고지 두 문장과 가입 행동을 보여 준다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const hero = page.locator('#hero');
    await expect(hero.getByText('KNU 룸메는 학교 공식 서비스가 아닙니다.')).toBeInViewport({
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
      await page.setViewportSize(viewport);
      await page.goto('/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${viewport.width}px`).toBe(0);
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
});

test.describe('Landing runtime SEO boundary', () => {
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
