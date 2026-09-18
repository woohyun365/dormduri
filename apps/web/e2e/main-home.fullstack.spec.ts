import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { HomeDashboardResponse } from '@repo/shared/home';
import {
  issueHomeE2eSessionToken,
  resetHomeE2eSeed,
  setHomeE2eSamcheokOperated,
  type HomeE2eSeedMode,
} from './support/home-e2e-seed';

const nonOperatedEmail = 'test-samcheok-m@kangwon.ac.kr';
const homeViewerEmail = 'home-e2e-viewer@kangwon.ac.kr';
const historyOnlyEmail = 'home-e2e-history@kangwon.ac.kr';
const incompleteEmail = 'home-e2e-incomplete@kangwon.ac.kr';
const fixturePassword = '1q2w3e4r';
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

async function fetchHomeDashboard(page: Page): Promise<HomeDashboardResponse> {
  const dashboardResponse = await page.request.get('/api/home/dashboard');
  if (!dashboardResponse.ok()) {
    expect(dashboardResponse.ok(), await dashboardResponse.text()).toBe(true);
  }

  return (await dashboardResponse.json()) as HomeDashboardResponse;
}

async function closeServiceIntroIfVisible(page: Page) {
  const closeButton = page.getByRole('button', { name: '서비스 안내 닫기' });
  try {
    await closeButton.waitFor({ state: 'visible', timeout: 2_000 });
    await closeButton.click();
  } catch {
    // service-intro 안내가 이미 닫혔거나 account state로 비노출이면 그대로 진행한다.
  }
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

function expectCurrentMatchingDashboard(dashboard: HomeDashboardResponse) {
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
  expect(dashboard.stats.assignedParticipants).toBeGreaterThanOrEqual(53);
  expect(dashboard.stats.buildingMatchable).toBeGreaterThanOrEqual(12);
  expect(dashboard.stats.totalMatchSuccess).toBeGreaterThanOrEqual(2);
  expect(dashboard.stats.buildingMatchSuccess).toBeGreaterThanOrEqual(2);
  expect(dashboard.matching.pendingReceivedCount).toBeGreaterThanOrEqual(1);
  expect(dashboard.matching.unreadMessageCount).toBeGreaterThanOrEqual(1);
  expect(dashboard.matching.activeMatch).not.toBeNull();
  expect(dashboard.seasonHistorySummary.lastSeason).toMatchObject({
    name: '2026년 1학기',
    viewerHadRegistration: true,
    viewerHadMatchSuccess: true,
  });
  expect(dashboard.seasonHistorySummary.lastSeason?.totalParticipants).toBeGreaterThanOrEqual(3);
  expect(dashboard.seasonHistorySummary.lastSeason?.totalMatchSuccess).toBeGreaterThanOrEqual(2);
  expect(
    dashboard.seasonHistorySummary.lastSeason?.aggregate.matchedPairCount,
  ).toBeGreaterThanOrEqual(1);
  expect(
    dashboard.seasonHistorySummary.lastSeason?.aggregate.operatedDormitoryCount,
  ).toBeGreaterThanOrEqual(1);
}

function expectPastHistorySummary(
  dashboard: HomeDashboardResponse,
  { viewerHadMatchSuccess }: { viewerHadMatchSuccess: boolean },
) {
  expect(dashboard.seasonHistorySummary.lastSeason).toMatchObject({
    name: '2026년 1학기',
    viewerHadRegistration: true,
    viewerHadMatchSuccess,
  });
  expect(dashboard.seasonHistorySummary.lastSeason?.totalParticipants).toBeGreaterThanOrEqual(3);
  expect(dashboard.seasonHistorySummary.lastSeason?.totalMatchSuccess).toBeGreaterThanOrEqual(2);
  expect(dashboard.seasonHistorySummary.lastSeason?.viewerActivity.finalResult).toBe(
    viewerHadMatchSuccess ? 'MATCHED' : 'NO_MATCH',
  );
  expect(
    dashboard.seasonHistorySummary.lastSeason?.aggregate.matchedPairCount,
  ).toBeGreaterThanOrEqual(1);
}

function isDesktopProject(testInfo: TestInfo) {
  return testInfo.project.name.includes('desktop');
}

test.describe('authenticated /main Home dashboard full-stack smoke', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterAll(() => resetHomeE2eSeed('current-matching'));

  test('로그인 UI 입력으로 session cookie를 받고 /main으로 이동한다', async ({ page }) => {
    await waitForApiHealth(page);
    await page.context().clearCookies();
    await page.goto('/login');

    await page.getByRole('textbox', { name: '이메일' }).fill(homeViewerEmail);
    await page.getByRole('textbox', { name: '비밀번호' }).fill(fixturePassword);
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page).toHaveURL(/\/main(?:$|\?)/);
    await expect(page.getByRole('heading', { name: /홈스모크남님/ })).toBeVisible();
  });

  test('renders seeded Home dashboard matrix for desktop/mobile users', async ({
    page,
  }, testInfo) => {
    await resetSeedForTest(page, 'current-matching');
    await authenticateWithSeedSession(page, homeViewerEmail);

    const dashboard = await fetchHomeDashboard(page);
    expectCurrentMatchingDashboard(dashboard);

    await page.goto('/main');
    await closeServiceIntroIfVisible(page);

    await expect(page).toHaveURL(/\/main(?:$|\?)/);
    await expect(page.getByRole('heading', { name: /홈스모크남님/ })).toBeVisible();
    await expect(page.getByRole('main', { name: '홈 주요 상태' })).toBeVisible();
    if (isDesktopProject(testInfo)) {
      await expect(page.getByRole('complementary', { name: '홈 보조 정보' })).toBeVisible();
    }
    await expect(
      page.getByRole('heading', { name: '확정된 룸메이트와 남은 일정을 확인해요.' }),
    ).toBeVisible();
    const activeMatch = page.getByRole('region', { name: '확정된 룸메이트', exact: true });
    await expect(activeMatch.getByRole('heading', { name: '확정된 룸메이트' })).toBeVisible();
    // Starting a new conversation and entering the existing matched thread are separate intents.
    await expect(activeMatch.getByRole('button', { name: '채팅 바로가기' })).toBeEnabled();
    await activeMatch.getByRole('button', { name: '채팅 바로가기' }).click();
    await expect(page.getByRole('heading', { name: '채팅', exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /대화 상대 매칭 대화/ })).toBeVisible();
  });

  test('captures past-season registration without match success for history-only users', async ({
    page,
  }) => {
    await resetSeedForTest(page, 'current-matching');
    await authenticateWithSeedSession(page, historyOnlyEmail);

    const dashboard = await fetchHomeDashboard(page);
    expect(dashboard.viewer.identity.user.email).toBe(historyOnlyEmail);
    expectPastHistorySummary(dashboard, { viewerHadMatchSuccess: false });
  });

  test('renders future season preview when there is no active current season', async ({ page }) => {
    const beforeSeed = Date.now();
    await resetSeedForTest(page, 'future-preview');
    const afterSeed = Date.now();
    await authenticateWithSeedSession(page, homeViewerEmail);

    const dashboard = await fetchHomeDashboard(page);
    expect(dashboard.season).toMatchObject({
      hasCurrentSeason: false,
      state: 'OFF_SEASON',
      isOpen: false,
      isMatching: false,
      isPostMatch: false,
    });
    expectPastHistorySummary(dashboard, { viewerHadMatchSuccess: true });
    const preview = dashboard.nextSeasonPreview;
    expect(preview).not.toBeNull();
    if (!preview) throw new Error('Expected a future season preview');
    // Independently bound the seed's KST day, including a midnight during seed/reset.
    const dateAfterDays = (timestamp: number, days: number) =>
      new Date(timestamp + (9 + days * 24) * 60 * 60 * 1_000).toISOString().slice(0, 10);
    expect([dateAfterDays(beforeSeed, 7), dateAfterDays(afterSeed, 7)]).toContain(
      preview.preparationStartDate,
    );
    const preparationKstStart = Date.parse(`${preview.preparationStartDate}T00:00:00+09:00`);
    expect(dashboard.nextSeasonPreview).toMatchObject({
      name: '2026년 2학기',
      preparationStartDate: preview.preparationStartDate,
      matchingStartDate: dateAfterDays(preparationKstStart, 7),
      seasonEndDate: dateAfterDays(preparationKstStart, 38),
      visibleToUser: true,
      operatedDormitories: expect.arrayContaining([
        expect.objectContaining({
          dormitoryId: 'dasan',
          roomSelectionDate: dateAfterDays(preparationKstStart, 21),
        }),
        expect.objectContaining({
          dormitoryId: 'yeji',
          roomSelectionDate: dateAfterDays(preparationKstStart, 21),
        }),
      ]),
    });

    await page.goto('/main');
    await closeServiceIntroIfVisible(page);

    await expect(
      page.getByRole('heading', { name: '2026년 2학기 준비가 곧 시작돼요' }),
    ).toBeVisible();
    const primary = page.getByTestId('home-section-primary');
    await expect(primary.getByText('이전 시즌 요약', { exact: true })).toBeVisible();
    await expect(primary.getByText('시즌 오픈:', { exact: true })).toBeVisible();
    await expect(
      primary.getByText(preview.preparationStartDate.replaceAll('-', '.'), { exact: true }),
    ).toBeVisible();
  });

  test('opens building selection only through explicit season-open profile setup', async ({
    page,
  }) => {
    await resetSeedForTest(page, 'season-open');
    await authenticateWithSeedSession(page, incompleteEmail);

    const dashboard = await fetchHomeDashboard(page);
    expect(dashboard.season).toMatchObject({
      hasCurrentSeason: true,
      state: 'SEASON_OPEN',
      isOpen: true,
    });
    expect(dashboard.viewer.seasonProfile).toMatchObject({
      profileExists: true,
      registered: false,
      canSelectDormitory: true,
      completion: {
        profileCompletionRequired: false,
        dormitorySelectionRequired: true,
      },
    });
    expect(dashboard.viewer.capabilities.canSelectDormitory).toBe(true);

    await page.goto('/main');
    await closeServiceIntroIfVisible(page);

    await expect(page.getByRole('heading', { name: '시즌 참여를 준비해요' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: '배정 건물 선택' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: '시즌 프로필/기숙사 설정', exact: true }).click();
    await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: '배정 건물 선택' })).toHaveCount(0);
    await page.getByRole('button', { name: '건물 미배정', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '배정 건물 선택' })).toBeVisible();
  });

  test('renders post-match result-oriented Home state', async ({ page }) => {
    await resetSeedForTest(page, 'post-match');
    await authenticateWithSeedSession(page, homeViewerEmail);

    const dashboard = await fetchHomeDashboard(page);
    expect(dashboard.season).toMatchObject({
      hasCurrentSeason: true,
      state: 'SEASON_POST_MATCH',
      isPostMatch: true,
    });
    expect(dashboard.viewer.match.hasActiveMatch).toBe(true);
    expectPastHistorySummary(dashboard, { viewerHadMatchSuccess: true });

    await page.goto('/main');
    await closeServiceIntroIfVisible(page);

    const primary = page.getByTestId('home-section-primary');
    await expect(primary.getByRole('heading', { name: /매칭이 종료됐어요\./ })).toBeVisible();
    await expect(primary.getByText('이번 시즌 요약', { exact: true })).toBeVisible();
    await expect(primary.getByRole('button', { name: /시즌 결과 보기/ })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '이번 시즌 활동 기록을 확인해요' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '확정스모크남', exact: true })).toBeVisible();
  });

  test('keeps non-operated campus users in fail-closed waiting UX', async ({ page }) => {
    await resetSeedForTest(page, 'current-matching');
    await authenticateWithSeedSession(page, nonOperatedEmail);
    const previousOperated = setHomeE2eSamcheokOperated(false);
    try {
      const dashboard = await fetchHomeDashboard(page);
      expect(dashboard.viewer.campusOperated).toBe(false);
      expect(dashboard.viewer.capabilities.canEnterRoommateSearch).toBe(false);
      await page.goto('/main');

      await expect(page).toHaveURL(/\/main(?:$|\?)/);
      await expect(page.getByRole('heading', { name: '삼척로그인남님' })).toBeVisible();
      await expect(page.getByText('해당 캠퍼스는 서비스 운영 준비 중이에요!')).toBeVisible();
      await expect(page.getByTestId('home-content')).toHaveAttribute('aria-hidden', 'true');
      await expect(page.getByTestId('home-content')).toHaveAttribute('inert', '');
    } finally {
      expect(setHomeE2eSamcheokOperated(previousOperated)).toBe(false);
    }
    expect((await fetchHomeDashboard(page)).viewer.campusOperated).toBe(previousOperated);
  });
});
