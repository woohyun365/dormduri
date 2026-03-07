import { describe, it, expect } from 'vitest';
import {
  validateKnuEmail,
  validatePassword,
  validatePasswordConfirm,
  validateNickname,
} from '../validation';

describe('validateKnuEmail', () => {
  it('정상 강원대 이메일 -> 빈 문자열', () => {
    expect(validateKnuEmail('test@kangwon.ac.kr')).toBe('');
  });

  it('빈 값 -> 에러', () => {
    expect(validateKnuEmail('')).toBeTruthy();
  });

  it('타 도메인 -> 에러', () => {
    expect(validateKnuEmail('test@gmail.com')).toBeTruthy();
  });

  it('@kangwon.ac.kr 없이 -> 에러', () => {
    expect(validateKnuEmail('test')).toBeTruthy();
  });

  it('유사 도메인 -> 에러', () => {
    expect(validateKnuEmail('test@kangwon.ac.kr.fake')).toBeTruthy();
  });

  it('서브도메인 포함 -> 에러', () => {
    expect(validateKnuEmail('test@sub.kangwon.ac.kr')).toBeTruthy();
  });

  it('숫자 포함 이메일 -> 통과', () => {
    expect(validateKnuEmail('user123@kangwon.ac.kr')).toBe('');
  });

  it('점 포함 이메일 -> 통과', () => {
    expect(validateKnuEmail('user.name@kangwon.ac.kr')).toBe('');
  });
});

describe('validatePassword', () => {
  it('영문+숫자 8자 이상 -> 빈 문자열', () => {
    expect(validatePassword('abcd1234')).toBe('');
  });

  it('빈 값 -> 에러', () => {
    expect(validatePassword('')).toBeTruthy();
  });

  it('7자 (길이 미달) -> 에러', () => {
    expect(validatePassword('abc1234')).toBeTruthy();
  });

  it('8자 경계값 -> 통과', () => {
    expect(validatePassword('abcd1234')).toBe('');
  });

  it('영문만 -> 에러', () => {
    expect(validatePassword('abcdefgh')).toBeTruthy();
  });

  it('숫자만 -> 에러', () => {
    expect(validatePassword('12345678')).toBeTruthy();
  });

  it('특수문자+영문+숫자 -> 통과', () => {
    expect(validatePassword('abc123!@#')).toBe('');
  });

  it('대문자 포함 -> 통과', () => {
    expect(validatePassword('Abcd1234')).toBe('');
  });
});

describe('validatePasswordConfirm', () => {
  it('일치 -> 빈 문자열', () => {
    expect(validatePasswordConfirm('abcd1234', 'abcd1234')).toBe('');
  });

  it('불일치 -> 에러', () => {
    expect(validatePasswordConfirm('abcd1234', 'abcd5678')).toBeTruthy();
  });

  it('빈 문자열끼리 일치 -> 빈 문자열', () => {
    expect(validatePasswordConfirm('', '')).toBe('');
  });
});

describe('validateNickname', () => {
  // NICKNAME_MIN = 2, NICKNAME_MAX = 12

  it('정상 닉네임 -> 빈 문자열', () => {
    expect(validateNickname('곰두리')).toBe('');
  });

  it('빈 값 -> 에러', () => {
    expect(validateNickname('')).toBeTruthy();
  });

  it('1자 (min 미만) -> 에러', () => {
    expect(validateNickname('가')).toBeTruthy();
  });

  it('2자 (min 경계) -> 통과', () => {
    expect(validateNickname('가나')).toBe('');
  });

  it('12자 (max 경계) -> 통과', () => {
    expect(validateNickname('가나다라마바사아자차카타')).toBe('');
  });

  it('13자 (max 초과) -> 에러', () => {
    expect(validateNickname('가나다라마바사아자차카타파')).toBeTruthy();
  });

  it('영문 닉네임 -> 통과', () => {
    expect(validateNickname('roommate')).toBe('');
  });

  it('숫자 포함 -> 통과', () => {
    expect(validateNickname('유저123')).toBe('');
  });
});
