import { expect, test } from '@playwright/test';

test.describe('Public legal documents', () => {
  test('비로그인 사용자는 /terms 공개 문서를 볼 수 있다', async ({ page }) => {
    await page.goto('/terms');

    await expect(page.getByRole('heading', { level: 1, name: 'KNU 룸메 이용약관' })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('status')).toContainText('저장된 공개 안내를 표시');
    await expect(page.locator('body')).not.toContainText(
      /\.omx|apps\/web|web-terms-privacy-refactor-plan/i,
    );
  });

  test('비로그인 사용자는 /privacy 공개 문서를 볼 수 있다', async ({ page }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { level: 1, name: 'KNU 룸메 개인정보 처리방침' }),
    ).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('status')).toContainText('저장된 공개 안내를 표시');
    await expect(page.getByRole('navigation', { name: '문서 목차' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(
      /\.omx|apps\/web|web-terms-privacy-refactor-plan/i,
    );
  });
});
