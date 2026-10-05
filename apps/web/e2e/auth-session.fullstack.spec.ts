import { expect, test } from '@playwright/test';
import { expireHomeE2eAccessToken } from './support/home-e2e-seed';
import { resolveAuthCookieNames } from '@/config/auth-cookie.config';

const viewerEmail = 'home-e2e-viewer@kangwon.ac.kr';
const viewerPassword = '1q2w3e4r';
const homeE2eRuntimeMode =
  process.env.HOME_E2E_WEB_RUNTIME_MODE === 'production' ? 'production' : 'development';
const authCookieNames = resolveAuthCookieNames(homeE2eRuntimeMode);

test.describe('Login/session full-stack boundary', () => {
  test('remember-off session은 access 만료 후 renewal하고 browser-session cookie를 유지한다', async ({
    page,
  }) => {
    await page.context().clearCookies();

    const loginResponse = await page.request.post('/api/auth/login', {
      data: {
        email: viewerEmail,
        password: viewerPassword,
        rememberMe: false,
      },
    });
    expect(loginResponse.ok(), await loginResponse.text()).toBe(true);

    const beforeCookies = await page.context().cookies();
    const beforeAccess = beforeCookies.find((cookie) => cookie.name === authCookieNames.access);
    const beforeRenewal = beforeCookies.find((cookie) => cookie.name === authCookieNames.renewal);
    expect(beforeAccess).toBeDefined();
    expect(beforeRenewal).toBeDefined();
    expect(beforeAccess?.expires).toBe(-1);
    expect(beforeRenewal?.expires).toBe(-1);

    expireHomeE2eAccessToken(beforeAccess?.value ?? '');

    const resolutionResponse = await page.request.post('/api/auth/session/resolve');
    expect(resolutionResponse.ok(), await resolutionResponse.text()).toBe(true);
    await expect(resolutionResponse.json()).resolves.toMatchObject({
      status: 'authenticated',
      user: { email: viewerEmail },
    });

    const renewedCookies = await page.context().cookies();
    const renewedAccess = renewedCookies.find((cookie) => cookie.name === authCookieNames.access);
    const renewedRenewal = renewedCookies.find((cookie) => cookie.name === authCookieNames.renewal);
    expect(renewedAccess?.value).not.toBe(beforeAccess?.value);
    expect(renewedRenewal?.value).not.toBe(beforeRenewal?.value);
    expect(renewedAccess?.expires).toBe(-1);
    expect(renewedRenewal?.expires).toBe(-1);
  });

  test('logout 후 session resolve는 unauthenticated로 수렴한다', async ({ page }) => {
    await page.context().clearCookies();

    const loginResponse = await page.request.post('/api/auth/login', {
      data: {
        email: viewerEmail,
        password: viewerPassword,
        rememberMe: true,
      },
    });
    expect(loginResponse.ok(), await loginResponse.text()).toBe(true);

    const logoutResponse = await page.request.post('/api/auth/logout');
    expect(logoutResponse.ok(), await logoutResponse.text()).toBe(true);

    const resolutionResponse = await page.request.post('/api/auth/session/resolve');
    expect(resolutionResponse.ok(), await resolutionResponse.text()).toBe(true);
    await expect(resolutionResponse.json()).resolves.toEqual({ status: 'unauthenticated' });
  });
});
