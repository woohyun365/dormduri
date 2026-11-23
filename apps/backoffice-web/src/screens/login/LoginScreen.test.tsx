import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const passkeys = vi.hoisted(() => ({ signWithPasskey: vi.fn() }));
vi.mock('@/client/passkeys', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/client/passkeys')>()),
  signWithPasskey: passkeys.signWithPasskey,
}));

const fetchMock = vi.fn<typeof fetch>();
const CHALLENGE = {
  challengeId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  options: { challenge: 'c'.repeat(43) },
  recovery: { totp: true, recoveryCode: false },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  passkeys.signWithPasskey.mockReset();
  router.replace.mockReset();
});

async function passwordStep() {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: '이메일' }), 'owner@backoffice.test');
  await user.type(
    screen.getByLabelText('비밀번호', { exact: true }),
    'correct horse battery staple',
  );
  await user.click(screen.getByRole('button', { name: '다음' }));
  return user;
}

describe('LoginScreen', () => {
  it('logs in with the password and then a passkey through the BFF only', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, CHALLENGE))
      .mockResolvedValueOnce(json(200, { scope: 'FULL' }));
    passkeys.signWithPasskey.mockResolvedValue({ id: 'cred' });
    render(<LoginScreen ended={null} />);
    const user = await passwordStep();
    await user.click(await screen.findByRole('button', { name: 'passkey로 로그인' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/login/password',
      '/api/auth/login/passkey',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]!.body))).toEqual({
      challengeId: CHALLENGE.challengeId,
      credential: { id: 'cred' },
    });
  });

  it('offers only the recovery methods the account has, and a recovery login goes to /recovery', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, CHALLENGE))
      .mockResolvedValueOnce(json(200, { scope: 'RECOVERY' }));
    render(<LoginScreen ended={null} />);
    const user = await passwordStep();
    expect(
      await screen.findByRole('button', { name: 'TOTP code로 복구 로그인' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '복구 code로 복구 로그인' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'TOTP code로 복구 로그인' }));
    await user.type(screen.getByRole('textbox', { name: 'TOTP code(6자리)' }), '123456');
    await user.click(screen.getByRole('button', { name: '복구 로그인' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/recovery'));
  });

  it('shows one message for every password failure (no account enumeration)', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'authentication_failed' } }));
    render(<LoginScreen ended={null} />);
    await passwordStep();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '로그인 정보가 맞지 않거나 계정을 쓸 수 없습니다.',
    );
  });

  it('explains an ended session', () => {
    render(<LoginScreen ended="idle" />);
    expect(screen.getByRole('alert')).toHaveTextContent('15분 동안 활동이 없어 접속이 끝났습니다.');
  });

  it('says when the API could not confirm a logout', () => {
    render(<LoginScreen ended="unconfirmed" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '백오피스 API가 로그아웃을 확인하지 못했습니다.',
    );
  });
});
