import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { totpCode } from './support/totp';
import {
  addVirtualAuthenticator,
  replaceVirtualAuthenticator,
  type VirtualAuthenticator,
} from './support/virtual-authenticator';

/**
 * Registration → login → access request → approval → audit against the real backoffice API, with
 * the owner on a platform passkey and the second operator on a security key, then every other BFF
 * route once (rejection, cancellation, invitation revoke, deactivation, monthly review, credential
 * reissue, recovery logins and a recovery passkey), so each route meets the real API's status and
 * body. Every page is checked for CSP violations; the session cookie and the response headers are
 * checked on the real responses.
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

const LEAVER = {
  email: 'leaver@backoffice.test',
  password: 'leaver e2e password 2026',
  name: '퇴직 운영자',
};

/** Ended access notices (README §4): the login page's, and the console shell's without the last sentence. */
const CLOSED_SHELL_NOTICE =
  '이 접속은 끝났습니다. 다른 창에서 로그아웃했거나 역할·계정 상태가 바뀌었을 수 있습니다.';
const CLOSED_LOGIN_NOTICE = `${CLOSED_SHELL_NOTICE} 다시 로그인하세요.`;

/** BFF routes that answered 2xx in the flow, path ids replaced by `:id`. */
const reachedRoutes = new Set<string>();
const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/)/gu;

interface Operator {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly cspViolations: string[];
  authenticator: VirtualAuthenticator;
}

test.describe.configure({ mode: 'serial' });

let owner: Operator;
let operator: Operator;
let leaver: Operator | undefined;
let operatorCode: string;
let ownerTotpSecret: string;
let ownerRecoveryCode: string;

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
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/') && response.status() < 300) {
      reachedRoutes.add(url.pathname.replace(UUID_SEGMENT, '/:id'));
    }
  });
  const authenticator = await addVirtualAuthenticator(context, page, transport);
  return { context, page, cspViolations, authenticator };
}

/** The CSP violations of a page opened after `openOperator`, collected the same way. */
function watchCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/iu.test(message.text())) {
      violations.push(message.text());
    }
  });
  return violations;
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
    ownerTotpSecret = secret;
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
  expect(leaver?.cspViolations ?? []).toEqual([]);
});

test.afterAll(async () => {
  await owner?.context.close();
  await operator?.context.close();
  await leaver?.context.close();
});

/**
 * A code the API has not used yet: the next 30-second step. The API accepts ±1 step and each step
 * once, so a login right after a confirmation with the current code still gets a fresh one.
 */
function nextTotpCode(secret: string): string {
  return totpCode(secret, Date.now() + 30_000);
}

async function loginWithPassword({ page }: Operator, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('이메일', { exact: true }).fill(email);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '다음' }).click();
}

/** The invitation drawer the accounts page title's `운영자 초대` opens. */
async function openInvite(page: Page) {
  await page.getByRole('button', { name: '운영자 초대' }).click();
  return page.getByRole('dialog', { name: '운영자 초대' });
}

/** The new request form, in the right drawer the page title's `새 요청` opens. */
async function openNewRequest(page: Page) {
  await page.getByRole('button', { name: '새 요청' }).click();
  const drawer = page.getByRole('dialog', { name: '새 요청' });
  return { drawer, form: drawer.getByRole('form', { name: '권한 요청 만들기' }) };
}

async function requestRole(
  { page }: Operator,
  kind: 'ROLE_GRANT' | 'ROLE_REVOKE',
  role: 'OWNER' | 'AUDITOR' | 'LEGAL_EDITOR',
) {
  await page.goto('/access');
  const { drawer, form } = await openNewRequest(page);
  await form.getByLabel('종류', { exact: true }).selectOption(kind);
  await form
    .getByLabel('대상 운영자', { exact: true })
    .selectOption({ label: `${OPERATOR.name} (${OPERATOR.email})` });
  await form.getByLabel('역할', { exact: true }).selectOption(role);
  await drawer.getByRole('button', { name: '요청 만들기' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '권한 요청을 만들었습니다.' }),
  ).toBeVisible();
  await expect(drawer).toHaveCount(0);
}

/**
 * Chooses the waiting request of this kind and role in the request list (master-detail) and returns its detail, a region
 * named by its heading `<kind> · <target>`; the decision form `요청 … 결정` and the cancel sit in it.
 */
async function choosePendingRequest(page: Page, kind: string, role: string) {
  await page
    .getByRole('list', { name: '요청 목록' })
    .getByRole('listitem')
    .filter({ hasText: kind })
    .filter({ hasText: role })
    .filter({ hasText: '대기' })
    .getByRole('button')
    .click();
  const detail = page.getByRole('region', { name: new RegExp(`^${kind} · `, 'u') });
  await expect(detail).toContainText(role);
  return detail;
}

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

  // No poll and no prefetch: an open page must not keep the idle session alive (README §4). A
  // second page of the same session runs a fake clock past the 15-minute limit; every request it
  // sends after the first render is counted (a poll, a prefetch or any other fetch), and the idle
  // notice must come from the countdown alone.
  const idle = await owner.context.newPage();
  await idle.clock.install();
  await idle.goto('/');
  await expect(idle.getByRole('heading', { name: `${OWNER.name}님, 안녕하세요` })).toBeVisible();
  const requests: string[] = [];
  idle.on('request', (request) => {
    requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  // Exact: the home's `권한 요청 보기` link would match the menu item's name in part.
  await idle.getByRole('link', { name: '권한 요청', exact: true }).hover();
  await idle.clock.runFor(16 * 60 * 1000);
  await expect(
    idle.getByRole('alert').filter({ hasText: '15분 동안 활동이 없어 접속이 끝났습니다.' }),
  ).toBeVisible();
  expect(requests).toEqual([]);
  await idle.close();
});

test('the owner invites an operator who registers with a security key', async () => {
  const { page } = owner;
  await page.getByRole('link', { name: '운영자 계정' }).click();
  const drawer = await openInvite(page);
  await drawer
    .getByRole('form', { name: '운영자 초대' })
    .getByLabel('이메일', { exact: true })
    .fill(OPERATOR.email);
  await drawer
    .getByRole('form', { name: '운영자 초대' })
    .getByLabel('이름', { exact: true })
    .fill(OPERATOR.name);
  await drawer.getByRole('button', { name: '초대 code 만들기' }).click();
  await expect(drawer).toHaveCount(0);
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
  await page.getByRole('link', { name: '권한 요청', exact: true }).click();
  const { drawer, form } = await openNewRequest(page);
  await form.getByLabel('종류', { exact: true }).selectOption('ROLE_GRANT');
  await form
    .getByLabel('대상 운영자', { exact: true })
    .selectOption({ label: `${OPERATOR.name} (${OPERATOR.email})` });
  await form.getByLabel('역할', { exact: true }).selectOption('AUDITOR');
  await form.getByLabel('사유(선택)', { exact: true }).fill('월 점검 담당');
  await drawer.getByRole('button', { name: '요청 만들기' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '권한 요청을 만들었습니다.' }),
  ).toBeVisible();

  const detail = await choosePendingRequest(page, '역할 부여', '감사 열람(auditor)');
  await expect(detail).toContainText(OPERATOR.name);
  const decision = detail.getByRole('form', { name: /결정$/u });
  await decision
    .getByLabel('자기 승인 사유(필수)', { exact: true })
    .fill('승인 권한 운영자가 한 명뿐임');
  await decision.getByRole('button', { name: '승인' }).click();
  await expect(page.getByRole('status').filter({ hasText: '요청을 승인했습니다.' })).toBeVisible();
  // The decided request stays chosen: once the page reads it again, its decision area is gone and it shows its status
  // and the self-approval mark.
  await expect(decision).toHaveCount(0);
  await expect(detail.getByText('승인', { exact: true })).toBeVisible();
  await expect(detail.getByText('자기 승인', { exact: true })).toBeVisible();
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
  // The other grant's actor is an operator account, read by its short id (no actor kind before it).
  const actorColumn = (await table.getByRole('columnheader').allTextContents()).indexOf('행위자');
  expect(actorColumn).toBeGreaterThan(-1);
  const operatorGrant = grants.filter({ hasNotText: 'system' });
  await expect(operatorGrant).toHaveCount(1);
  await expect(operatorGrant.getByRole('cell').nth(actorColumn)).toHaveText(/^[0-9a-f]{8}$/u);
  // The auditor reads actors by id; names come with the account list, which needs the owner role.
  await expect(table).not.toContainText(OWNER.name);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('a second owner rejects a request and the owner cancels one', async () => {
  // The auditor becomes a second owner (still a self-approval: the owner is the only approver).
  await requestRole(owner, 'ROLE_GRANT', 'OWNER');
  const grant = (await choosePendingRequest(owner.page, '역할 부여', '소유자(owner)')).getByRole(
    'form',
    { name: /결정$/u },
  );
  await grant.getByLabel('자기 승인 사유(필수)', { exact: true }).fill('둘째 승인자를 둠');
  await grant.getByRole('button', { name: '승인' }).click();
  await expect(
    owner.page.getByRole('status').filter({ hasText: '요청을 승인했습니다.' }),
  ).toBeVisible();

  // With two approvers the other owner decides, and a rejection needs a reason.
  await requestRole(owner, 'ROLE_REVOKE', 'AUDITOR');
  await operator.page.goto('/access');
  const revokeDetail = await choosePendingRequest(operator.page, '역할 회수', '감사 열람(auditor)');
  const revoke = revokeDetail.getByRole('form', { name: /결정$/u });
  await revoke.getByLabel('결정 사유(거절할 때 필수)', { exact: true }).fill('감사 담당을 유지함');
  await revoke.getByRole('button', { name: '거절' }).click();
  await expect(
    operator.page.getByRole('status').filter({ hasText: '요청을 거절했습니다.' }),
  ).toBeVisible();
  // The decided request stays chosen: once the page reads it again, the decision's reason and the status.
  await expect(revoke).toHaveCount(0);
  await expect(revokeDetail).toContainText('감사 담당을 유지함');
  await expect(revokeDetail.getByText('거절', { exact: true })).toBeVisible();

  await requestRole(owner, 'ROLE_GRANT', 'LEGAL_EDITOR');
  await (
    await choosePendingRequest(owner.page, '역할 부여', '법적 문서 편집(legal-editor)')
  )
    .getByRole('button', { name: '요청 취소' })
    .click();
  await expect(
    owner.page.getByRole('status').filter({ hasText: '요청을 취소했습니다.' }),
  ).toBeVisible();
});

test('the owner revokes an invitation, deactivates an account and records the monthly review', async ({
  browser,
}) => {
  const { page } = owner;
  await page.goto('/accounts');
  let drawer = await openInvite(page);
  let invite = drawer.getByRole('form', { name: '운영자 초대' });
  await invite.getByLabel('이메일', { exact: true }).fill(LEAVER.email);
  await invite.getByLabel('이름', { exact: true }).fill(LEAVER.name);
  await drawer.getByRole('button', { name: '초대 code 만들기' }).click();
  const leaverCode = (await page.getByTestId('invitation-code').textContent())!.trim();
  leaver = await openOperator(browser, 'usb');
  await register(leaver, leaverCode, LEAVER.password, { confirmTotp: false });
  await expect(
    leaver.page.getByRole('heading', { name: `${LEAVER.name}님, 안녕하세요` }),
  ).toBeVisible();

  await page.goto('/accounts');
  drawer = await openInvite(page);
  invite = drawer.getByRole('form', { name: '운영자 초대' });
  await invite.getByLabel('이메일', { exact: true }).fill('unused@backoffice.test');
  await invite.getByLabel('이름', { exact: true }).fill('쓰지 않을 초대');
  await drawer.getByRole('button', { name: '초대 code 만들기' }).click();
  await expect(page.getByTestId('invitation-code')).toBeVisible();
  await page.goto('/accounts');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'unused@backoffice.test' })
    .getByRole('button', { name: '초대 취소' })
    .click();
  await expect(page.getByRole('status').filter({ hasText: '초대를 취소했습니다.' })).toBeVisible();

  // The leaver keeps a console page open while the account is deactivated (README §4, ended access).
  await leaver.page.goto('/security');
  await expect(leaver.page.getByRole('heading', { name: '내 보안 설정' })).toBeVisible();

  await page
    .getByRole('row')
    .filter({ hasText: LEAVER.name })
    .getByRole('button', { name: '비활성화' })
    .click();
  const confirm = page.getByRole('alertdialog', { name: '계정 비활성화' });
  const deactivate = confirm.getByRole('form', { name: '계정 비활성화' });
  await deactivate.getByLabel('비활성화 사유', { exact: true }).fill('퇴직');
  await confirm.getByRole('button', { name: '비활성화', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '계정을 비활성화했습니다.' }),
  ).toBeVisible();
  const leaverRow = page.getByRole('row').filter({ hasText: LEAVER.name });
  await expect(leaverRow.getByRole('cell', { name: '비활성', exact: true })).toBeVisible();
  await expect(leaverRow.getByRole('button', { name: '비활성화' })).toHaveCount(0);
  // The dialog's opener left with the refreshed row, so focus waits on the result instead of falling to the page.
  await expect(
    page.getByRole('status').filter({ hasText: '계정을 비활성화했습니다.' }),
  ).toBeFocused();

  // (a) A new page in the leaver's browser: the cookie is still there but the API no longer knows the session.
  const reopened = await leaver.context.newPage();
  const reopenedCspViolations = watchCspViolations(reopened);
  await reopened.goto('/');
  await expect(reopened).toHaveURL(/\/login\?ended=closed$/u);
  // Next.js keeps an empty route announcer with the alert role on every page, so the notice is picked by its text.
  await expect(reopened.getByRole('alert').filter({ hasText: CLOSED_SHELL_NOTICE })).toHaveText(
    CLOSED_LOGIN_NOTICE,
  );
  expect(reopenedCspViolations).toEqual([]);
  await reopened.close();

  // (b) The page left open: its next BFF call finds the session closed. That answer clears the cookie, so it comes
  // after (a), whose page would otherwise go to the plain /login of a browser without a cookie.
  await leaver.page
    .getByRole('form', { name: 'passkey 추가' })
    .getByRole('button', { name: 'passkey 추가' })
    .click();
  const closedNotice = leaver.page.getByRole('alert').filter({ hasText: CLOSED_SHELL_NOTICE });
  await expect(closedNotice).toBeVisible();
  await expect(closedNotice.getByRole('link', { name: '다시 로그인' })).toHaveAttribute(
    'href',
    '/login?ended=closed',
  );
  // The screen's own result keeps its words and place but is read after the shell's notice (README §4).
  await expect(
    leaver.page.getByRole('status').filter({ hasText: '다시 로그인하세요.' }),
  ).toBeVisible();
  await expect(
    leaver.page.getByRole('alert').filter({ hasText: '다시 로그인하세요.' }),
  ).toHaveCount(0);

  await page.goto('/audit');
  await page.getByRole('button', { name: '월 점검 기록' }).click();
  const reviewDrawer = page.getByRole('dialog', { name: '월 점검 기록' });
  const review = reviewDrawer.getByRole('form', { name: '월 점검 기록' });
  await review.getByLabel('점검 메모(선택)', { exact: true }).fill('11월 대조 이상 없음');
  await reviewDrawer.getByRole('button', { name: '점검 완료 기록' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '점검 완료를 기록했습니다.' }),
  ).toBeVisible();
});

test('the owner reissues TOTP and recovery codes and adds a passkey on another device', async () => {
  const { page } = owner;
  await page.goto('/security');
  await page.getByRole('button', { name: 'TOTP 새로 발급' }).click();
  ownerTotpSecret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await expect(page.getByText('확인한 TOTP가 없습니다.')).toBeVisible();
  await page.getByLabel('인증 앱의 6자리 code', { exact: true }).fill(totpCode(ownerTotpSecret));
  await page.getByRole('button', { name: 'TOTP 확인' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'TOTP를 확인했습니다.' })).toBeVisible();

  await page.getByRole('button', { name: /^복구 code 새로 발급/u }).click();
  const codes = page.getByRole('list', { name: '복구 code' }).getByRole('listitem');
  await expect(codes).toHaveCount(10);
  ownerRecoveryCode = (await codes.first().textContent())!.trim();

  // Adding a passkey needs no re-authentication (the API asks it for approvals, role requests,
  // deactivation and the two reissues), so the new, empty device answers only the registration.
  owner.authenticator = await replaceVirtualAuthenticator(owner.authenticator, 'usb');
  await page
    .getByRole('form', { name: 'passkey 추가' })
    .getByRole('button', { name: 'passkey 추가' })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'passkey를 추가했습니다.' }),
  ).toBeVisible();
});

test('the owner logs in with TOTP and with a recovery code; a recovery session adds a passkey', async () => {
  const { page } = owner;
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('heading', { name: '백오피스 로그인' })).toBeVisible();

  await loginWithPassword(owner, OWNER.email, OWNER.password);
  await page.getByRole('button', { name: 'TOTP code로 복구 로그인' }).click();
  await page.getByLabel('TOTP code(6자리)', { exact: true }).fill(nextTotpCode(ownerTotpSecret));
  await page.getByRole('button', { name: '복구 로그인' }).click();
  await expect(page.getByRole('heading', { name: '복구 로그인' })).toBeVisible();
  owner.authenticator = await replaceVirtualAuthenticator(owner.authenticator, 'internal');
  await page.getByRole('button', { name: '새 passkey 등록' }).click();
  await expect(page.getByText('새 passkey를 등록했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('heading', { name: '백오피스 로그인' })).toBeVisible();

  await loginWithPassword(owner, OWNER.email, OWNER.password);
  await page.getByRole('button', { name: '복구 code로 복구 로그인' }).click();
  await page.getByLabel('복구 code', { exact: true }).fill(ownerRecoveryCode);
  await page.getByRole('button', { name: '복구 로그인' }).click();
  await expect(page.getByRole('heading', { name: '복구 로그인' })).toBeVisible();
  await page.getByRole('button', { name: '로그아웃' }).click();

  // The passkey added in the recovery session logs in.
  await loginWithPassword(owner, OWNER.email, OWNER.password);
  await page.getByRole('button', { name: 'passkey로 로그인' }).click();
  await expect(page.getByRole('heading', { name: `${OWNER.name}님, 안녕하세요` })).toBeVisible();

  // (c) The audit list names both recovery logins by their second factor, from the LOGIN metadata the API writes.
  await page.goto('/audit');
  const events = page.getByRole('table', { name: '관리자 감사 기록, 최신순' });
  await expect(
    events.getByRole('row').filter({ hasText: '복구 로그인(TOTP)' }).first(),
  ).toBeVisible();
  await expect(
    events.getByRole('row').filter({ hasText: '복구 로그인(복구 code)' }).first(),
  ).toBeVisible();
});

test('the flow reached every BFF route through the real backoffice API', () => {
  expect([...reachedRoutes].sort()).toEqual(
    [
      '/api/access/requests',
      '/api/access/requests/:id/approve',
      '/api/access/requests/:id/cancel',
      '/api/access/requests/:id/reject',
      '/api/accounts/:id/deactivate',
      '/api/accounts/invitations',
      '/api/accounts/invitations/:id/revoke',
      '/api/audit/reviews',
      '/api/auth/login/passkey',
      '/api/auth/login/password',
      '/api/auth/login/recovery-code',
      '/api/auth/login/totp',
      '/api/auth/logout',
      '/api/auth/passkeys',
      '/api/auth/passkeys/options',
      '/api/auth/reauthentication',
      '/api/auth/reauthentication/options',
      '/api/auth/recovery-codes',
      '/api/auth/registration',
      '/api/auth/registration/options',
      '/api/auth/totp',
      '/api/auth/totp/confirm',
    ].sort(),
  );
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
  // A page request another localhost port or site caused never renders (and never reads a session).
  for (const site of ['same-site', 'cross-site']) {
    const page = await api.get('/login', { headers: { 'sec-fetch-site': site } });
    expect(page.status()).toBe(403);
  }
  // A prefetch from that page (`<link rel="prefetch">`) is refused the same way.
  const prefetches: Record<string, string>[] = [
    { purpose: 'prefetch' },
    { 'next-router-prefetch': '1' },
  ];
  for (const prefetch of prefetches) {
    const page = await api.get('/', { headers: { 'sec-fetch-site': 'same-site', ...prefetch } });
    expect(page.status()).toBe(403);
  }
  expect((await api.get('/login', { headers: { 'sec-fetch-site': 'none' } })).status()).toBe(200);
  await api.dispose();
});
