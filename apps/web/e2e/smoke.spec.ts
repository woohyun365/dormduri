import { expect, test } from '@playwright/test';

test.describe('Web smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);

      window.fetch = (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/api/auth/session/resolve')) {
          return Promise.resolve(
            new Response(JSON.stringify({ status: 'unauthenticated' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        return originalFetch(input, init);
      };
    });

    await page.route('**/api/auth/session/resolve', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'unauthenticated' }),
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
    await expect(
      page.locator('p:visible').filter({ hasText: /강원대학교.*독립 운영 서비스/ }),
    ).toBeVisible();
  });

  test('회원가입 화면의 이메일 인증 시작점을 렌더링한다', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.getByRole('heading', { name: '이메일 인증' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '학교 이메일' })).toBeVisible();
    await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
    await expect(page.getByRole('link', { name: '비밀번호 찾기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '자세히 보기' })).toBeVisible();
  });

  test('비밀번호 재설정 화면은 계정 존재 여부를 노출하지 않는 시작점을 렌더링한다', async ({
    page,
  }) => {
    await page.goto('/password-reset');

    await expect(page.getByRole('heading', { name: '비밀번호 재설정' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '학교 이메일 확인' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '학교 이메일' })).toBeVisible();
    await expect(page.getByRole('button', { name: '인증 코드 받기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인으로 돌아가기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '계정이 없으면 회원가입' })).toBeVisible();
    await expect(page.getByText(/가입된 계정/)).toHaveCount(0);
  });

  test('비로그인 사용자의 보호 라우트 접근은 로그인으로 리다이렉트한다', async ({ page }) => {
    await page.goto('/main');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  });
});
