import { expect, test } from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { legalDocumentNames, legalScreenCopy } from '@/screens/legal/model/legalScreenCopy';
import { WEB_FULLSTACK_LEGAL_LAST_SUCCESS_DIR } from './support/legal-last-success-fixture';

// Public legal reading against the seeded development API: a published answer is
// shown with the published source mark and kept as this Web's last success, with its periods of
// application and the articles changed from the version before; a version address opens that version, and
// a version the API does not have is "not found" (404). The seed has no scheduled version, so the new
// version notice is the screen tests' and Storybook's to check.
const labels = legalScreenCopy.versionStatusLabel;

test.describe('Public legal documents from the API', () => {
  test('/privacy는 API 게시본을 보여주고 그 응답을 마지막 성공본으로 남긴다', async ({ page }) => {
    const kept = join(WEB_FULLSTACK_LEGAL_LAST_SUCCESS_DIR, 'page.PRIVACY_POLICY.current.json');
    await rm(kept, { force: true });

    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { level: 1, name: '돔두리 개인정보 처리방침' }),
    ).toBeVisible();
    await expect(page.locator('[data-dormduri-legal-source="published"]')).toHaveCount(1);
    await expect(page.getByText(/마지막으로 확인한/)).toHaveCount(0);

    const file = JSON.parse(await readFile(kept, 'utf8')) as {
      checkedAt: string;
      response: { viewing: { kind: string; effectiveAt: string } };
    };
    expect(file.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(file.response.viewing.kind).toBe('PRIVACY_POLICY');
  });

  test('/privacy는 적용 기간과 이전 판 기록, 이전 판과 달라진 조항을 보여준다', async ({
    page,
  }) => {
    await page.goto('/privacy');

    const versions = page.getByRole('region', { name: legalScreenCopy.versionsTitle });
    await expect(versions.getByRole('listitem')).toHaveCount(2);
    await expect(
      versions.getByRole('listitem').filter({ hasText: legalScreenCopy.viewingVersionLabel }),
    ).toContainText(labels.current);
    await expect(
      versions.getByRole('link', {
        name: `${labels.previous} 2026년 6월 22일 ~ 2026년 11월 19일 ${legalScreenCopy.viewVersionLabel}`,
      }),
    ).toHaveAttribute('href', '/privacy?version=2026-06-22');

    const comparison = page.getByRole('region', { name: legalScreenCopy.comparisonTitle });
    const articles = comparison.getByRole('heading', { level: 3 });
    await expect(articles.first()).toBeVisible();
    const changeLabels = Object.values(legalScreenCopy.articleChangeLabel);
    for (const text of await articles.allTextContents()) {
      expect(
        changeLabels.some((label) => text.endsWith(label)),
        text,
      ).toBe(true);
    }
    await expect(comparison.getByText(legalScreenCopy.comparisonBeforeLabel).first()).toBeVisible();
    await expect(comparison.getByText(legalScreenCopy.comparisonAfterLabel).first()).toBeVisible();
    const sectionId = await comparison.getByRole('heading', { level: 2 }).getAttribute('id');
    await expect(
      page.getByRole('link', { name: legalScreenCopy.comparisonLinkLabel }),
    ).toHaveAttribute('href', `#${sectionId}`);
  });

  test('판 주소는 그 판을 연다', async ({ page }) => {
    await page.goto('/privacy?version=2026-06-22');

    const notice = page.getByRole('note').filter({ hasText: labels.previous }).first();
    await expect(notice).toContainText('2026년 6월 22일');
    await expect(
      notice.getByRole('link', { name: legalScreenCopy.viewCurrentVersionLabel }),
    ).toHaveAttribute('href', '/privacy');
    await expect(page.locator('[data-dormduri-legal-source="published"]')).toHaveCount(1);
  });

  test('API에 없는 판 주소는 404와 그 판이 없다는 화면을 낸다', async ({ page }) => {
    const response = await page.goto('/terms?version=2026-01-01');

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: `${legalDocumentNames.TERMS_OF_SERVICE}${legalScreenCopy.versionNotFoundTitleSuffix}`,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: legalScreenCopy.viewCurrentVersionLabel }),
    ).toHaveAttribute('href', '/terms');
  });
});
