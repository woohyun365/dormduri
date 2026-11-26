import { expect, test } from '@playwright/test';

// The Web-only lane has no API, so the two documents in effect come from the last success files the global setup
// writes from the legal seed (e2e/support/legal-last-success-fixture.ts, checked 2026-11-25 18:30 KST). Version
// addresses have no kept file. The published path against a running API is legal.fullstack.spec.ts.
const INTERNAL_TEXT =
  /\.omx|apps\/web|web-terms-privacy-refactor-plan|active 사용자|user-facing|read model|payload|tombstone|cache|active 계정|ticket|공개 API/i;
const LAST_SUCCESS_NOTICE = /2026년 11월 25일 18:30에 마지막으로 확인한 문서/;

test.describe('Public legal documents without the API', () => {
  test('비로그인 사용자는 /terms에서 마지막으로 확인한 문서와 확인 시각을 본다', async ({
    page,
  }) => {
    await page.goto('/terms');

    await expect(page.getByRole('heading', { level: 1, name: '돔두리 이용약관' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '제1조(목적)' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: LAST_SUCCESS_NOTICE })).toBeVisible();
    await expect(page.locator('[data-dormduri-legal-source="last-success"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: '이전 화면으로 돌아가기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '홈으로', exact: true })).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('button', { name: '인쇄하기' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(INTERNAL_TEXT);
    await expect(page.locator('body')).not.toContainText(/terms-\d{4}-\d{2}-\d{2}/);
  });

  test('모바일 사용자는 본문 전에 접이식 문서 목차를 볼 수 있다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/privacy');

    await expect(page.getByText('문서 목차 먼저 보기')).toBeVisible();
    await page.getByText('문서 목차 먼저 보기').click();
    await expect(page.getByRole('navigation', { name: '문서 목차 먼저 보기' })).toBeVisible();
  });

  test('비로그인 사용자는 /privacy에서 마지막으로 확인한 문서를 본다', async ({ page }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { level: 1, name: '돔두리 개인정보 처리방침' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '제1조(개인정보의 처리 목적)' }),
    ).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: LAST_SUCCESS_NOTICE })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);

    const viewportWidth = page.viewportSize()?.width ?? 0;
    if (viewportWidth >= 1024) {
      await expect(page.getByRole('navigation', { name: '문서 목차' })).toBeVisible();
    } else {
      await expect(page.getByText('문서 목차 먼저 보기')).toBeVisible();
    }

    await expect(page.locator('body')).not.toContainText(INTERNAL_TEXT);
    await expect(page.locator('body')).not.toContainText(/privacy-\d{4}-\d{2}-\d{2}/);
  });

  test('보관한 문서가 없는 시행일 주소는 문서를 불러오지 못했다고 알린다', async ({ page }) => {
    await page.goto('/privacy?version=2026-06-22');

    await expect(
      page.getByRole('heading', { level: 1, name: '문서를 불러오지 못했습니다' }),
    ).toBeVisible();
    await expect(page.locator('[data-dormduri-legal-source]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/');
  });

  test('형식이 틀린 시행일 주소는 그 시행일의 문서가 없다고 알리고 시행 중인 문서로 안내한다', async ({
    page,
  }) => {
    await page.goto('/terms?version=next');

    await expect(
      page.getByRole('heading', { level: 1, name: '해당 시행일의 문서를 찾을 수 없습니다' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: '지금 시행 중인 문서 보기' })).toHaveAttribute(
      'href',
      '/terms',
    );
    await expect(page.locator('[data-dormduri-legal-source]')).toHaveCount(0);
  });
});
