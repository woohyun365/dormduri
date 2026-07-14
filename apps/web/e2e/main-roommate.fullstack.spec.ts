import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import {
  issueHomeE2eSessionToken,
  resetHomeE2eSeed,
  type HomeE2eSeedMode,
} from './support/home-e2e-seed';

const roommateFilterViewerEmail = 'home-e2e-requester@kangwon.ac.kr';
const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const apiHealthUrl = `${process.env.API_URL ?? 'http://127.0.0.1:4000'}/health`;

async function authenticateWithSeedSession(page: Page, email: string) {
  await page.context().clearCookies();
  const accessToken = issueHomeE2eSessionToken(email);

  await page.context().addCookies([
    {
      name: 'auth-token',
      value: accessToken,
      url: webBaseUrl,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

async function waitForApiHealth(page: Page) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 20_000) {
    try {
      const response = await page.request.get(apiHealthUrl, { timeout: 2_000 });
      if (response.ok()) return;
      lastError = new Error(`API health responded ${response.status()}`);
    } catch (error) {
      lastError = error;
    }
    await page.waitForTimeout(500);
  }

  throw lastError instanceof Error ? lastError : new Error('API health did not become ready');
}

async function resetSeedForTest(page: Page, mode: HomeE2eSeedMode) {
  resetHomeE2eSeed(mode);
  await waitForApiHealth(page);
}

async function closeServiceIntroIfVisible(page: Page) {
  const closeButton = page.getByRole('button', { name: '서비스 안내 닫기' });
  try {
    await closeButton.waitFor({ state: 'visible', timeout: 2_000 });
    await closeButton.click();
  } catch {
    // 서비스 안내가 없으면 그대로 진행한다.
  }
}

test.describe('authenticated /main Roommate filter full-stack smoke', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterAll(() => resetHomeE2eSeed('current-matching'));

  test('조건 필터 적용 query가 실제 roommate-search BFF/API 요청으로 전달된다', async ({
    page,
  }) => {
    await resetSeedForTest(page, 'current-matching');
    await authenticateWithSeedSession(page, roommateFilterViewerEmail);

    await page.goto('/main');
    await closeServiceIntroIfVisible(page);
    await page
      .getByRole('navigation', { name: '메인 네비게이션' })
      .getByRole('button', { name: '룸메 찾기' })
      .click();

    await expect(page.getByRole('heading', { name: /룸메이트/ })).toBeVisible();
    await expect(page.getByRole('region', { name: '검색 결과 설정' })).toBeVisible();
    await expect(page.getByRole('button', { name: '필터 열기' })).toBeVisible();

    await page.getByRole('button', { name: '필터 열기' }).click();
    const dialog = page.getByRole('dialog', { name: '상대 생활패턴·프로필 필터' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('원하는 상대의 흡연 여부')).toBeVisible();
    await expect(dialog.getByText('원하는 상대의 잠귀 밝음 정도')).toBeVisible();
    await expect(dialog.getByText(/같은 건물 후보만 볼 수 있어요/)).toHaveCount(0);

    await dialog.getByRole('button', { name: '비흡연' }).click();
    await dialog.getByRole('button', { name: '80점 이상' }).click();

    const filteredResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/roommate-search' &&
        url.searchParams.get('scope') === 'SAME_BUILDING_ONLY' &&
        url.searchParams.get('sort') === 'MATCH_SCORE' &&
        url.searchParams.get('smokingBehavior') === 'NO' &&
        url.searchParams.get('minScore') === '80'
      );
    });

    await dialog.getByRole('button', { name: '필터 적용' }).click();
    const filteredResponse = await filteredResponsePromise;
    if (!filteredResponse.ok()) {
      throw new Error(`Filtered roommate-search request failed: ${await filteredResponse.text()}`);
    }

    const payload = (await filteredResponse.json()) as {
      scope: string;
      appliedSort: string;
      manifest: { purpose: string };
      items: unknown[];
    };
    expect(payload.scope).toBe('SAME_BUILDING_ONLY');
    expect(payload.appliedSort).toBe('MATCH_SCORE');
    expect(payload.manifest.purpose).toBe('ACTIONABLE_DETAIL_DISCOVERY');
    expect(Array.isArray(payload.items)).toBe(true);

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: '흡연 여부 비흡연 필터 제거' })).toBeVisible();
    await expect(page.getByRole('button', { name: '매칭점수 80점 이상 필터 제거' })).toBeVisible();
  });
});
