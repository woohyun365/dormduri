import { expect, test } from '@playwright/test';

test.describe('Public legal documents', () => {
  test('비로그인 사용자는 /terms 공개 문서를 볼 수 있다', async ({ page }) => {
    await page.goto('/terms');

    await expect(page.getByRole('heading', { level: 1, name: 'KNU 룸메 이용약관' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '제1조(목적)' })).toBeVisible();
    await expect(page.getByRole('button', { name: '이전 화면으로 돌아가기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '홈으로', exact: true })).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('button', { name: '인쇄하기' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(
      /\.omx|apps\/web|web-terms-privacy-refactor-plan|terms-\d{4}-\d{2}-\d{2}|active 사용자|user-facing|read model|payload|tombstone|cache|active 계정|ticket|공개 API/i,
    );
  });

  test('모바일 사용자는 본문 전에 접이식 문서 목차를 볼 수 있다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/privacy');

    await expect(page.getByText('문서 목차 먼저 보기')).toBeVisible();
    await page.getByText('문서 목차 먼저 보기').click();
    await expect(page.getByRole('navigation', { name: '문서 목차 먼저 보기' })).toBeVisible();
  });

  test('비로그인 사용자는 /privacy 공개 문서를 볼 수 있다', async ({ page }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { level: 1, name: 'KNU 룸메 개인정보 처리방침' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '제1조(개인정보의 처리 목적)' }),
    ).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: '문서 목차' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(
      /\.omx|apps\/web|web-terms-privacy-refactor-plan|privacy-\d{4}-\d{2}-\d{2}|active 사용자|user-facing|read model|payload|tombstone|cache|active 계정|ticket|공개 API/i,
    );
  });
});
