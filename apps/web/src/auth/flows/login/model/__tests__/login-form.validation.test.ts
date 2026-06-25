import { describe, expect, it } from 'vitest';
import { hasLoginFieldErrors, validateLoginForm } from '../login-form.validation';

describe('validateLoginForm', () => {
  it('empty email/password error를 반환한다', () => {
    const errors = validateLoginForm({ email: '', password: '', rememberMe: false });

    expect(errors).toEqual({
      email: '이메일을 입력해주세요.',
      password: '비밀번호를 입력해주세요.',
    });
    expect(hasLoginFieldErrors(errors)).toBe(true);
  });

  it('강원대 이메일 형식과 password required만 검증한다', () => {
    expect(
      validateLoginForm({
        email: 'student@example.com',
        password: 'password123',
        rememberMe: false,
      }),
    ).toEqual({ email: '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.' });
    expect(
      validateLoginForm({
        email: 'student@kangwon.ac.kr',
        password: 'password123',
        rememberMe: true,
      }),
    ).toEqual({});
  });
});
