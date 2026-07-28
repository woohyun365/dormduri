import { expect, test } from '@playwright/test';

test.describe('Web smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);

      window.fetch = (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/api/auth/session')) {
          return Promise.resolve(
            new Response(JSON.stringify({ authenticated: false }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        return originalFetch(input, init);
      };
    });

    await page.route('**/api/auth/session**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }),
      });
    });
  });

  test('비로그인 사용자가 공개 랜딩을 볼 수 있다', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('#hero');

    await expect(
      hero.getByRole('heading', { name: /생활패턴이 맞는.*룸메이트를 찾아요/ }),
    ).toBeVisible();
    await expect(hero.getByRole('link', { name: '학교 이메일로 시작하기' })).toBeVisible();
    await expect(hero.getByRole('link', { name: '이용 흐름 보기' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
  });

  test('로그인 화면의 핵심 폼 컨트롤을 렌더링한다', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '이메일' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '비밀번호' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '로그인 유지(최대 7일)' })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
    await expect(page.getByRole('button', { name: '비밀번호 찾기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '이메일로 회원가입' })).toBeVisible();
    const loginPanel = page.locator('section[aria-labelledby="login-title"]');
    await expect(
      loginPanel.getByText(/본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다\./),
    ).toBeVisible();
  });

  test('회원가입 화면의 이메일 인증 시작점을 렌더링한다', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.getByRole('heading', { name: '이메일 인증' })).toBeVisible();
    await expect(page.getByLabel('학교 이메일')).toBeVisible();
    await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
    await expect(page.getByRole('link', { name: '비밀번호 찾기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '자세히 보기' })).toBeVisible();
  });

  test('비밀번호 재설정 화면은 계정 존재 여부를 노출하지 않는 시작점을 렌더링한다', async ({
    page,
  }) => {
    await page.goto('/password-reset');

    await expect(page.getByRole('heading', { name: '비밀번호 재설정' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '비밀번호 찾기' })).toBeVisible();
    await expect(page.getByLabel('학교 이메일')).toBeVisible();
    await expect(page.getByRole('button', { name: '인증 코드 전송' })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인으로 돌아가기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '계정이 없으면 회원가입' })).toBeVisible();
    const passwordResetHelp = page.locator(
      '[data-testid="password-reset-help-panel"]:visible, [data-testid="password-reset-mobile-email-help"]:visible',
    );
    await expect(passwordResetHelp).toHaveCount(1);
    await expect(passwordResetHelp).toContainText('메일이 오지 않으면');
    await expect(passwordResetHelp).toContainText('주소와 스팸함');
    await expect(page.getByText(/가입된 계정/)).toHaveCount(0);
  });

  test('비로그인 사용자의 보호 라우트 접근은 로그인으로 리다이렉트한다', async ({ page }) => {
    await page.goto('/main');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  });
});
