import { expect, test } from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { WEB_FULLSTACK_LEGAL_LAST_SUCCESS_DIR } from './support/legal-last-success-fixture';

// Public legal reading against the seeded development API: a published answer is
// shown with the published source mark and kept as this Web's last success, a version address opens that version, and
// a version the API does not have is "not found".
test.describe('Public legal documents from the API', () => {
  test('/privacy는 API 게시본을 보여주고 그 응답을 마지막 성공본으로 남긴다', async ({ page }) => {
    const kept = join(WEB_FULLSTACK_LEGAL_LAST_SUCCESS_DIR, 'page.PRIVACY_POLICY.current.json');
    await rm(kept, { force: true });

    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { level: 1, name: '돔두리 개인정보 처리방침' }),
    ).toBeVisible();
    await expect(page.locator('[data-dormduri-legal-source="published"]')).toHaveCount(1);
    await expect(page.getByText(/마지막으로 확인한 문서/)).toHaveCount(0);

    const file = JSON.parse(await readFile(kept, 'utf8')) as {
      checkedAt: string;
      response: { viewing: { kind: string; effectiveAt: string } };
    };
    expect(file.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(file.response.viewing.kind).toBe('PRIVACY_POLICY');
  });

  test('시행일 주소는 그 판을 연다', async ({ page }) => {
    await page.goto('/privacy?version=2026-06-22');

    await expect(page.getByText('2026년 6월 22일 시행본').first()).toBeVisible();
    await expect(page.locator('[data-dormduri-legal-source="published"]')).toHaveCount(1);
  });

  test('API에 없는 시행일 주소는 그 시행일의 문서가 없다고 알린다', async ({ page }) => {
    await page.goto('/terms?version=2026-01-01');

    await expect(
      page.getByRole('heading', { level: 1, name: '해당 시행일의 문서를 찾을 수 없습니다' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: '지금 시행 중인 문서 보기' })).toHaveAttribute(
      'href',
      '/terms',
    );
  });
});
