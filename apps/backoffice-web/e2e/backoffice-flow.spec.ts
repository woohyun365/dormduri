import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { totpCode } from './support/totp';
import { addVirtualAuthenticator } from './support/virtual-authenticator';

/**
 * Registration → login → access request → approval → audit (plan §1 success criterion 3), with the
 * owner on a platform passkey and the second operator on a security key. Every page is checked for
 * CSP violations; the session cookie and the response headers are checked on the real responses.
 */

const OWNER = {
  email: 'owner@backoffice.test',
  password: 'owner e2e password 2026',
  name: 'Owner',
};
const OPERATOR = {
  email: 'auditor@backoffice.test',
  password: 'auditor e2e password 2026',
  name: '감사 운영자',
};

interface Operator {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly cspViolations: string[];
}

test.describe.configure({ mode: 'serial' });

let owner: Operator;
let operator: Operator;
let operatorCode: string;

async function openOperator(
  browser: import('@playwright/test').Browser,
  transport: 'internal' | 'usb',
): Promise<Operator> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cspViolations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/iu.test(message.text())) {
      cspViolations.push(message.text());
    }
  });
  await addVirtualAuthenticator(context, page, transport);
  return { context, page, cspViolations };
}

async function register(
  { page }: Operator,
  code: string,
  password: string,
  { confirmTotp }: { readonly confirmTotp: boolean },
) {
  await page.goto('/register');
  await page.getByLabel('등록 code', { exact: true }).fill(code);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByLabel('비밀번호 확인', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'passkey 만들고 등록' }).click();
  await expect(page.getByRole('list', { name: '복구 code' }).getByRole('listitem')).toHaveCount(10);
  if (confirmTotp) {
    const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
    await page.getByLabel('인증 앱의 6자리 code', { exact: true }).fill(totpCode(secret));
    await page.getByRole('button', { name: 'TOTP 확인' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'TOTP를 확인했습니다.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '시작하기' }).click();
  } else {
    await page.getByRole('button', { name: 'TOTP는 나중에 확인하고 시작하기' }).click();
  }
}

test.beforeAll(async ({ browser }) => {
  owner = await openOperator(browser, 'internal');
  operator = await openOperator(browser, 'usb');
});

test.afterEach(() => {
  expect(owner.cspViolations).toEqual([]);
  expect(operator.cspViolations).toEqual([]);
});

test.afterAll(async () => {
  await owner?.context.close();
  await operator?.context.close();
});

test('the first owner registers with a platform passkey and confirms TOTP', async () => {
  const code = process.env.BACKOFFICE_E2E_BOOTSTRAP_CODE;
  expect(code, 'global setup issues the bootstrap code').toBeTruthy();
  await register(owner, code!, OWNER.password, { confirmTotp: true });
  await expect(
    owner.page.getByRole('heading', { name: `${OWNER.name}님, 안녕하세요` }),
  ).toBeVisible();

  const [cookie] = await owner.context.cookies();
  expect(cookie).toMatchObject({
    name: 'dormduri_bo_session',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    expires: -1,
  });
  expect(await owner.page.evaluate(() => document.cookie)).toBe('');

  const response = await owner.page.goto('/');
  const headers = response!.headers();
  expect(headers['content-security-policy']).toMatch(
    /^default-src 'self'; script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'$/u,
  );
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['cache-control']).toContain('no-store');
  const second = await owner.page.request.get('/');
  expect(second.headers()['content-security-policy']).not.toBe(headers['content-security-policy']);
});

test('the owner logs out and logs in again with password and passkey; an idle page sends nothing', async () => {
  const { page } = owner;
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('heading', { name: '백오피스 로그인' })).toBeVisible();
  expect(await owner.context.cookies()).toEqual([]);

  await page.getByLabel('이메일', { exact: true }).fill(OWNER.email);
  await page.getByLabel('비밀번호', { exact: true }).fill(OWNER.password);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'passkey로 로그인' }).click();
  await expect(page.getByRole('heading', { name: `${OWNER.name}님, 안녕하세요` })).toBeVisible();

  // No poll and no prefetch: an open page must not keep the idle session alive (plan §15). A fresh
  // document load mounts the menu links, so a viewport or hover prefetch would show up as an RSC
  // request, and a poll as a BFF call.
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) {
      requests.push(`${request.method()} ${url.pathname}`);
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: `${OWNER.name}님, 안녕하세요` })).toBeVisible();
  await page.getByRole('link', { name: '권한 요청' }).hover();
  await page.waitForTimeout(3_000);
  expect(requests).toEqual([]);
});

test('the owner invites an operator who registers with a security key', async () => {
  const { page } = owner;
  await page.getByRole('link', { name: '운영자 계정' }).click();
  await page
    .getByRole('form', { name: '운영자 초대' })
    .getByLabel('이메일', { exact: true })
    .fill(OPERATOR.email);
  await page
    .getByRole('form', { name: '운영자 초대' })
    .getByLabel('이름', { exact: true })
    .fill(OPERATOR.name);
  await page.getByRole('button', { name: '초대 code 만들기' }).click();
  operatorCode = (await page.getByTestId('invitation-code').textContent())!.trim();
  expect(operatorCode.length).toBeGreaterThanOrEqual(16);

  await register(operator, operatorCode, OPERATOR.password, { confirmTotp: false });
  await expect(
    operator.page.getByRole('heading', { name: `${OPERATOR.name}님, 안녕하세요` }),
  ).toBeVisible();
  await expect(operator.page.getByRole('link', { name: '감사 기록' })).toHaveCount(0);
});

test('the owner requests the auditor role and approves it as the only approver', async () => {
  const { page } = owner;
  await page.getByRole('link', { name: '권한 요청' }).click();
  const form = page.getByRole('form', { name: '권한 요청 만들기' });
  await form.getByLabel('종류', { exact: true }).selectOption('ROLE_GRANT');
  await form
    .getByLabel('대상 운영자', { exact: true })
    .selectOption({ label: `${OPERATOR.name} (${OPERATOR.email})` });
  await form.getByLabel('역할', { exact: true }).selectOption('AUDITOR');
  await form.getByLabel('사유(선택)', { exact: true }).fill('월 점검 담당');
  await form.getByRole('button', { name: '요청 만들기' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '권한 요청을 만들었습니다.' }),
  ).toBeVisible();

  const request = page
    .getByRole('listitem')
    .filter({ hasText: `${OPERATOR.name}에게` })
    .filter({ hasText: '대기' });
  await request
    .getByLabel('자기 승인 사유(필수)', { exact: true })
    .fill('승인 권한 운영자가 한 명뿐임');
  await request.getByRole('button', { name: '승인' }).click();
  await expect(page.getByRole('status').filter({ hasText: '요청을 승인했습니다.' })).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: `${OPERATOR.name}에게` }),
  ).toContainText('승인 · 자기 승인');
});

test('the operator, now an auditor, finds the approval in the audit list', async () => {
  const { page } = operator;
  await page.goto('/');
  await page.getByRole('link', { name: '감사 기록' }).click();
  const table = page.getByRole('table', { name: '관리자 감사 기록, 최신순' });
  await expect(
    table.getByRole('row').filter({ hasText: '권한 요청 승인' }).filter({ hasText: '자기 승인' }),
  ).toHaveCount(1);
  // Two role grants: the bootstrap owner's (system actor) and the approved auditor's (operator actor).
  const grants = table.getByRole('row').filter({ hasText: '역할 부여' });
  await expect(grants).toHaveCount(2);
  await expect(grants.filter({ hasText: 'system' })).toHaveCount(1);
  await expect(grants.filter({ hasText: '운영자' })).toHaveCount(1);
  // The auditor reads actors by id; names are for the owner role (§12 disclosure matrix).
  await expect(table).not.toContainText(OWNER.name);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('state-changing BFF routes refuse forged origins and missing fetch metadata', async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:4300' });
  const cases: Record<string, string>[] = [
    { origin: 'http://localhost:3000', 'sec-fetch-site': 'same-site' },
    { origin: 'http://localhost:4300' },
    {
      origin: 'http://localhost:4300',
      'sec-fetch-site': 'same-origin',
      host: 'attacker.example:4300',
    },
  ];
  for (const headers of cases) {
    const response = await api.post('/api/access/requests', { headers, data: {} });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'forbidden_origin' } });
  }
  await api.dispose();
});
