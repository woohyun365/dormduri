import { expect, test, type Page } from '@playwright/test';
import { resetHomeE2eSeed, setHomeE2eSamcheokOperated } from './support/home-e2e-seed';

const destinations = [
  ['/main', '홈'],
  ['/main/roommates', '룸메 찾기'],
  ['/main/matching', '매칭 현황'],
  ['/main/chat', '채팅'],
  ['/main/profile', '프로필'],
] as const;
async function login(page: Page, email = 'home-e2e-viewer@kangwon.ac.kr') {
  await page.context().clearCookies();
  const result = await page.request.post('/api/auth/login', {
    data: { email, password: '1q2w3e4r', rememberMe: false },
  });
  expect(result.ok()).toBe(true);
}
async function ready(page: Page, pathname: string, label: string) {
  await expect(page).toHaveURL(new RegExp(`${pathname}$`));
  await expect(
    page
      .getByRole('navigation', { name: '메인 네비게이션' })
      .getByRole('link', { name: label, exact: label !== '매칭 현황' }),
  ).toHaveAttribute('aria-current', 'page');
  if (pathname === '/main')
    await expect(page.getByRole('heading', { name: /홈스모크남님/ })).toBeVisible();
  else if (pathname === '/main/roommates')
    await expect(page.getByRole('main', { name: '룸메이트 찾기 주요 목록' })).toBeVisible();
  else if (pathname === '/main/matching')
    await expect(page.locator('#matching-tab-heading')).toBeVisible();
  else
    await expect(
      page.getByRole('heading', {
        name: pathname === '/main/chat' ? '채팅' : '내 프로필',
        exact: true,
      }),
    ).toBeVisible();
}

test.describe('App Router destinations', () => {
  test.beforeAll(() => resetHomeE2eSeed('current-matching'));

  test('five deep links and refresh preserve destination and metadata, ignoring old activeTab storage', async ({
    page,
  }) => {
    await login(page);
    await page.addInitScript(() => sessionStorage.setItem('activeTab', 'profile'));
    for (const [pathname, label] of destinations) {
      await page.goto(pathname);
      await ready(page, pathname, label);
      await expect(page).toHaveTitle(
        new RegExp(pathname === '/main/profile' ? '내 프로필' : label),
      );
      await page.reload();
      await ready(page, pathname, label);
    }
  });

  test('Link navigation and back/forward reuse the single dashboard owner', async ({ page }) => {
    await login(page);
    let dashboardRequests = 0;
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/home/dashboard') dashboardRequests++;
    });
    await page.goto('/main/chat');
    await ready(page, '/main/chat', '채팅');
    const nav = page.getByRole('navigation', { name: '메인 네비게이션' });
    await nav.getByRole('link', { name: '프로필', exact: true }).click();
    await ready(page, '/main/profile', '프로필');
    await nav.getByRole('link', { name: '룸메 찾기', exact: true }).click();
    await ready(page, '/main/roommates', '룸메 찾기');
    await page.goBack();
    await ready(page, '/main/profile', '프로필');
    await page.goBack();
    await ready(page, '/main/chat', '채팅');
    await page.goForward();
    await ready(page, '/main/profile', '프로필');
    expect(dashboardRequests).toBe(1);
  });

  test('Matching query normalizes only owned keys and history updates selection without overview refetch', async ({
    page,
  }) => {
    // A matched viewer intentionally has no request inbox; use the existing unmatched participant.
    await login(page, 'home-e2e-requester@kangwon.ac.kr');
    let overviewRequests = 0;
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/matches/overview') overviewRequests++;
    });
    await page.goto('/main/matching?section=wrong&section=past&requestTab=received&campaign=keep');
    await expect(page).toHaveURL(/\/main\/matching\?campaign=keep&requestTab=received$/);
    await expect(page.getByRole('tab', { name: '현재 매칭', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: /^받은 요청/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: /^보낸 요청/ }).click();
    await expect(page).toHaveURL(/requestTab=sent$/);
    await page.getByRole('tab', { name: '지난 기록', exact: true }).click();
    await expect(page).toHaveURL(/section=past/);
    await expect(page.getByRole('tab', { name: '지난 기록', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goBack();
    await expect(page.getByRole('tab', { name: /^보낸 요청/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goBack();
    await expect(page.getByRole('tab', { name: /^받은 요청/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goForward();
    await expect(page.getByRole('tab', { name: /^보낸 요청/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(new URL(page.url()).searchParams.get('campaign')).toBe('keep');
    expect(overviewRequests).toBe(1);
  });

  test('Chat detail draft is discarded on route leave and not restored by browser back', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/main/chat');
    await ready(page, '/main/chat', '채팅');
    await page.getByRole('button', { name: /대화 상대 매칭 대화/ }).click();
    await page
      .getByRole('textbox', { name: '메시지', exact: true })
      .fill('전송하지 않는 route draft');
    await page
      .getByRole('navigation', { name: '메인 네비게이션' })
      .getByRole('link', { name: '프로필' })
      .click();
    await ready(page, '/main/profile', '프로필');
    await page.goBack();
    await ready(page, '/main/chat', '채팅');
    await page.getByRole('button', { name: /대화 상대 매칭 대화/ }).click();
    await expect(page.getByRole('textbox', { name: '메시지', exact: true })).toHaveValue('');
  });

  test('all five unauthenticated deep links fail closed to login', async ({ page }) => {
    await page.context().clearCookies();
    for (const [pathname] of destinations) {
      await page.goto(pathname);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
    }
  });

  test('disabled Matching direct URL gives a reason, not a feature request or navigating link', async ({
    page,
  }) => {
    const previousOperated = setHomeE2eSamcheokOperated(false);
    try {
      await login(page, 'test-samcheok-m@kangwon.ac.kr');
      let overviewRequests = 0;
      page.on('request', (r) => {
        if (new URL(r.url()).pathname === '/api/matches/overview') overviewRequests++;
      });
      await page.goto('/main/matching');
      await expect(page.getByText('캠퍼스 운영 준비 중이에요.')).toBeVisible();
      const nav = page.getByRole('navigation', { name: '메인 네비게이션' });
      await expect(nav.getByRole('link', { name: /매칭 현황/ })).toHaveCount(0);
      await expect(nav.getByRole('button', { name: /매칭 현황/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(overviewRequests).toBe(0);
    } finally {
      setHomeE2eSamcheokOperated(previousOperated);
    }
  });
});
