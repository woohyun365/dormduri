import { expect, test } from '@playwright/test';

test.describe('Web smoke', () => {
  test('비로그인 사용자가 랜딩 게이트웨이를 볼 수 있다', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /생활 패턴 맞는.*룸메를 미리 찾기/ }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: '로그인' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: '회원가입' }).first()).toBeVisible();
  });

  test('로그인 화면의 핵심 폼 컨트롤을 렌더링한다', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '이메일' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '비밀번호' })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
    await expect(page.getByRole('button', { name: '이메일로 회원가입' })).toBeVisible();
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
