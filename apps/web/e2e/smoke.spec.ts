import { expect, test } from '@playwright/test';

test.describe('Web smoke', () => {
  test('비로그인 사용자가 공개 랜딩을 볼 수 있다', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /생활패턴이 맞는.*룸메 후보를 확인하세요/ }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: '이메일로 시작하기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '이용 흐름 보기' })).toBeVisible();
  });

  test('로그인 화면의 핵심 폼 컨트롤을 렌더링한다', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '이메일' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '비밀번호' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '로그인 유지(최대 7일)' })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
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
  });

  test('비로그인 사용자의 보호 라우트 접근은 로그인으로 리다이렉트한다', async ({ page }) => {
    await page.goto('/main');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  });
});
