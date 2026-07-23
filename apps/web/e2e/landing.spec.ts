import { expect, test } from '@playwright/test';

test.describe('Landing public experience', () => {
  test('공개 랜딩은 hero, 정책 고지, CTA, 이용 도움을 렌더링한다', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('강원대 룸메이트 찾기');
    await expect(
      page.getByRole('heading', { name: /생활패턴이 맞는.*룸메 후보를 확인하세요/ }),
    ).toBeVisible();
    await expect(page.getByText(/독립 운영 서비스/).first()).toBeVisible();
    await expect(page.getByText(/학교 시스템과 연동하지 않고/).first()).toBeVisible();
    await expect(
      page.getByText(/호실 선택이나 기숙사 배정 성공을 보장하지 않습니다/).first(),
    ).toBeVisible();

    await expect(page.getByRole('link', { name: '이메일로 시작하기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '이용 흐름 보기' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    await expect(
      page.getByRole('heading', { name: '서비스 이용 중 도움이 필요하다면' }),
    ).toBeVisible();
    await expect(page.getByText('신고·차단')).toBeVisible();
    await expect(page.getByText('로그인 후 문의하기')).toBeVisible();
  });

  test('desktop section navigation은 hash route outcome을 만든다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop nav smoke');

    await page.goto('/');
    await page.getByRole('link', { name: '서비스 소개' }).click();

    await expect(page).toHaveURL(/#features$/);
    await expect(page.getByRole('heading', { name: '주요 기능' })).toBeVisible();
  });

  test('CTA links route to signup and login', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: '이메일로 시작하기' }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('heading', { name: '이메일 인증' })).toBeVisible();

    await page.goto('/');
    await page.getByRole('link', { name: '이미 계정이 있어요' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  });
});

test.describe('Landing mobile navigation', () => {
  test('mobile menu opens, follows hash link, and closes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile nav smoke');

    await page.goto('/');

    const menuButton = page.getByRole('button', { name: '메뉴' });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: '랜딩 모바일 내비게이션' })).toBeVisible();

    await page
      .getByRole('navigation', { name: '랜딩 모바일 내비게이션' })
      .getByRole('link', { name: '이용 도움' })
      .click();

    await expect(page).toHaveURL(/#support$/);
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(
      page.getByRole('heading', { name: '서비스 이용 중 도움이 필요하다면' }),
    ).toBeVisible();
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
