import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test as setup } from '@playwright/test';

const authStatePath = 'playwright/.auth/main-home.json';
const homeViewerEmail = process.env.HOME_E2E_EMAIL ?? 'home-e2e-viewer@kangwon.ac.kr';
const homeViewerPassword = process.env.HOME_E2E_PASSWORD ?? '1q2w3e4r';

setup('authenticate Home dashboard seed user through Web BFF', async ({ page }) => {
  mkdirSync(dirname(authStatePath), { recursive: true });

  const response = await page.request.post('/api/auth/login', {
    data: {
      email: homeViewerEmail,
      password: homeViewerPassword,
      rememberMe: false,
    },
  });

  if (!response.ok()) {
    expect(response.ok(), await response.text()).toBe(true);
  }
  await page.goto('/main');
  await expect(page).toHaveURL(/\/main(?:$|\?)/);
  await expect(page.getByRole('heading', { name: /홈스모크남님/ })).toBeVisible();

  await page.context().storageState({ path: authStatePath });
});
