import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const nonOperatedEmail = 'test-samcheok-m@kangwon.ac.kr';
const homeViewerEmail = 'home-e2e-viewer@kangwon.ac.kr';
const fixturePassword = '1q2w3e4r';

async function loginThroughBff(page: Page, email: string) {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password: fixturePassword, rememberMe: false },
  });

  if (!response.ok()) {
    expect(response.ok(), await response.text()).toBe(true);
  }
}

test.describe('authenticated /main Home dashboard full-stack smoke', () => {
  test('로그인 UI 입력으로 session cookie를 받고 /main으로 이동한다', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');

    await page.getByRole('textbox', { name: '이메일' }).fill(homeViewerEmail);
    await page.getByRole('textbox', { name: '비밀번호' }).fill(fixturePassword);
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page).toHaveURL(/\/main(?:$|\?)/);
    await expect(page.getByRole('heading', { name: /홈스모크남님/ })).toBeVisible();
  });

  test('renders seeded Home dashboard matrix for desktop/mobile users', async ({ page }) => {
    await loginThroughBff(page, homeViewerEmail);

    const dashboardResponse = await page.request.get('/api/home/dashboard');
    if (!dashboardResponse.ok()) {
      expect(dashboardResponse.ok(), await dashboardResponse.text()).toBe(true);
    }
    const dashboard = (await dashboardResponse.json()) as {
      season: { hasCurrentSeason: boolean; state: string | null; isMatching: boolean };
      viewer: {
        campusOperated: boolean;
        match: { hasActiveMatch: boolean };
        capabilities: { canStartChat: boolean; canEnterRoommateSearch: boolean };
      };
      stats: {
        assignedParticipants: number;
        buildingMatchable: number;
        buildingMatchSuccess: number;
      };
      matching: { pendingReceivedCount: number; unreadMessageCount: number; activeMatch: unknown };
    };

    expect(dashboard.season).toMatchObject({
      hasCurrentSeason: true,
      state: 'SEASON_MATCHING',
      isMatching: true,
    });
    expect(dashboard.viewer).toMatchObject({
      campusOperated: true,
      match: { hasActiveMatch: true },
      capabilities: { canStartChat: false, canEnterRoommateSearch: true },
    });
    expect(dashboard.stats.assignedParticipants).toBeGreaterThanOrEqual(3);
    expect(dashboard.stats.buildingMatchable).toBeGreaterThanOrEqual(2);
    expect(dashboard.stats.buildingMatchSuccess).toBeGreaterThanOrEqual(2);
    expect(dashboard.matching.pendingReceivedCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.matching.unreadMessageCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.matching.activeMatch).not.toBeNull();

    await page.goto('/main');

    await expect(page).toHaveURL(/\/main(?:$|\?)/);
    await expect(page.getByRole('heading', { name: /홈스모크남님/ })).toBeVisible();
    await expect(page.getByRole('main', { name: '홈 주요 상태' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: '홈 보조 정보' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /확정된 룸메 결과를 확인해요/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: '매칭 활동' })).toBeVisible();
    await expect(page.getByRole('button', { name: /채팅.*대화 보기/ })).toBeVisible();
  });

  test('keeps non-operated campus users in fail-closed waiting UX', async ({ page }) => {
    await loginThroughBff(page, nonOperatedEmail);
    await page.goto('/main');

    await expect(page).toHaveURL(/\/main(?:$|\?)/);
    await expect(page.getByRole('heading', { name: /테스트삼척남님/ })).toBeVisible();
    await expect(page.getByText('서비스 운영 준비 중이에요!')).toBeVisible();
    await expect(page.getByTestId('home-content')).toHaveAttribute('aria-hidden', 'true');
  });
});
