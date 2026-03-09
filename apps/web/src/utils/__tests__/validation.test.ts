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

  it('72자 경계값 -> 통과', () => {
    expect(validatePassword('a1' + 'x'.repeat(70))).toBe('');
  });

  it('73자 (max 초과) -> 에러', () => {
    expect(validatePassword('a1' + 'x'.repeat(71))).toBeTruthy();
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

  it('공백 포함 -> 통과 (패스프레이즈 허용)', () => {
    expect(validatePassword('my pass 1')).toBe('');
  });

  it('한글 포함 -> 통과 (영문+숫자 조건 충족 시)', () => {
    expect(validatePassword('비밀번호abc1')).toBe('');
  });

  it('이메일과 동일 -> 에러', () => {
    expect(validatePassword('test1234@kangwon.ac.kr', 'test1234@kangwon.ac.kr')).toBeTruthy();
  });

  it('이메일과 대소문자만 다름 -> 에러', () => {
    expect(validatePassword('TEST1234@kangwon.ac.kr', 'test1234@kangwon.ac.kr')).toBeTruthy();
  });

  it('이메일과 다름 -> 통과', () => {
    expect(validatePassword('abcd1234', 'test@kangwon.ac.kr')).toBe('');
  });

  it('email 미전달 시 이메일 비교 스킵', () => {
    expect(validatePassword('abcd1234')).toBe('');
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
  // NICKNAME_MIN = 2, NICKNAME_MAX = 8

  // 길이 검증
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

  it('8자 (max 경계) -> 통과', () => {
    expect(validateNickname('가나다라마바사아')).toBe('');
  });

  it('9자 (max 초과) -> 에러', () => {
    expect(validateNickname('가나다라마바사아자')).toBeTruthy();
  });

  // 허용 문자
  it('영문 닉네임 -> 통과', () => {
    expect(validateNickname('roommate')).toBe('');
  });

  it('숫자 포함 -> 통과', () => {
    expect(validateNickname('유저123')).toBe('');
  });

  it('한글+영문+숫자 조합 -> 통과', () => {
    expect(validateNickname('룸메abc1')).toBe('');
  });

  it('자모 단독 -> 에러', () => {
    expect(validateNickname('ㅋㅋㅋ')).toBeTruthy();
  });

  it('자모 포함 -> 에러', () => {
    expect(validateNickname('곰두리ㅋ')).toBeTruthy();
  });

  it('특수문자 -> 에러', () => {
    expect(validateNickname('곰두리!')).toBeTruthy();
  });

  it('공백 포함 -> 에러', () => {
    expect(validateNickname('곰 두리')).toBeTruthy();
  });

  it('이모지 -> 에러', () => {
    expect(validateNickname('곰두리😀')).toBeTruthy();
  });

  // trim
  it('앞뒤 공백 -> trim 후 통과', () => {
    expect(validateNickname('  곰두리  ')).toBe('');
  });

  it('공백만 입력 -> 에러', () => {
    expect(validateNickname('   ')).toBeTruthy();
  });

  // 예약어 — 한글 (포함 검사)
  it('예약어 "관리자" 정확 일치 -> 에러', () => {
    expect(validateNickname('관리자')).toBeTruthy();
  });

  it('예약어 "관리자" 포함 -> 에러', () => {
    expect(validateNickname('가짜관리자')).toBeTruthy();
  });

  it('예약어 "테스트" 포함 -> 에러', () => {
    expect(validateNickname('테스트123')).toBeTruthy();
  });

  it('예약어 "운영팀" 포함 -> 에러', () => {
    expect(validateNickname('운영팀원')).toBeTruthy();
  });

  // 예약어 — 영문 (정확 일치)
  it('예약어 "admin" 정확 일치 -> 에러', () => {
    expect(validateNickname('admin')).toBeTruthy();
  });

  it('예약어 "Admin" 대소문자 무시 -> 에러', () => {
    expect(validateNickname('Admin')).toBeTruthy();
  });

  it('영문 예약어 포함하는 일반 단어 -> 통과', () => {
    expect(validateNickname('greatest')).toBe('');
  });

  it('예약어 "demo" 정확 일치 -> 에러', () => {
    expect(validateNickname('demo')).toBeTruthy();
  });

  it('예약어 "test" 정확 일치 -> 에러', () => {
    expect(validateNickname('test')).toBeTruthy();
  });
});
