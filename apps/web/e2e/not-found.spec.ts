import { expect, test } from '@playwright/test';

const missingPath = '/no-such-page';

test.describe('없는 주소', () => {
  test('HTTP 404와 한국어 제목, 홈으로 link를 보이고 검색 색인에서 뺀다', async ({ page }) => {
    const response = await page.goto(missingPath);

    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle('돔두리 | 페이지를 찾을 수 없습니다');
    await expect(
      page.getByRole('heading', { level: 1, name: '페이지를 찾을 수 없습니다' }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('main').getByRole('link', { name: '홈으로' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  test('직접 연 없는 주소에서 이전 화면으로는 홈으로 간다', async ({ page }) => {
    await page.goto(missingPath);

    await page.getByRole('button', { name: '이전 화면으로' }).click();

    await expect(page).toHaveURL('/');
  });

  test('사이트 안 link로 온 없는 주소에서 이전 화면으로는 그 화면으로 돌아간다', async ({
    page,
  }) => {
    await page.goto('/terms');
    // A full load with this site's page as the referrer, as a broken link on that page would make.
    await page.evaluate((path) => window.location.assign(path), missingPath);
    await expect(
      page.getByRole('heading', { level: 1, name: '페이지를 찾을 수 없습니다' }),
    ).toBeVisible();

    await page.getByRole('button', { name: '이전 화면으로' }).click();

    await expect(page).toHaveURL('/terms');
  });
});
