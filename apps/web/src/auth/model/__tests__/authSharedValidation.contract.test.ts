import { describe, expect, it } from 'vitest';
import {
  parseLoginPasswordInput,
  parseNewPasswordStructure,
  validateKnuEmailFormat as validateKnuEmail,
  validatePasswordStructure as validatePassword,
} from '@repo/shared/auth/policy';
import { validateDisplayIdentityNicknameStructure as validateNickname } from '@repo/shared/user/identity';
import { validatePasswordConfirm } from '../authFormValidation';

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
  it('10자 이상 허용 ASCII -> 빈 문자열', () => {
    expect(validatePassword('abcd123456')).toBe('');
  });

  it('빈 값 -> 에러', () => {
    expect(validatePassword('')).toBeTruthy();
  });

  it('9자 (길이 미달) -> 에러', () => {
    expect(validatePassword('abc123456')).toBeTruthy();
  });

  it('10자 경계값 -> 통과', () => {
    expect(validatePassword('abcd123456')).toBe('');
  });

  it('128자 경계값 -> 통과', () => {
    expect(validatePassword('a1' + 'x'.repeat(126))).toBe('');
  });

  it('129자 (max 초과) -> 에러', () => {
    expect(validatePassword('a1' + 'x'.repeat(127))).toBeTruthy();
  });

  it('영문만으로 10자 이상이면 구조 검증 통과', () => {
    expect(validatePassword('abcdefghij')).toBe('');
  });

  it('숫자만으로 10자 이상이면 구조 검증 통과', () => {
    expect(validatePassword('1234567890')).toBe('');
  });

  it('특수문자+영문+숫자 -> 통과', () => {
    expect(validatePassword('abc123!@#$')).toBe('');
  });

  it('대문자 포함 -> 통과', () => {
    expect(validatePassword('Abcd123456')).toBe('');
  });

  it('공백 포함 -> 에러', () => {
    expect(validatePassword('my pass 1')).toBeTruthy();
  });

  it('ASCII 외 Unicode 포함 -> 에러', () => {
    expect(validatePassword('비밀번호abc1')).toBeTruthy();
  });

  it('이메일과 동일 -> 에러', () => {
    expect(validatePassword('test1234@kangwon.ac.kr', 'test1234@kangwon.ac.kr')).toBeTruthy();
  });

  it('이메일과 대소문자만 다름 -> 에러', () => {
    expect(validatePassword('TEST1234@kangwon.ac.kr', 'test1234@kangwon.ac.kr')).toBeTruthy();
  });

  it('이메일 로컬파트와 동일 -> 에러', () => {
    expect(validatePassword('knuStudent', 'knuStudent@kangwon.ac.kr')).toBeTruthy();
  });

  it('이메일과 다름 -> 통과', () => {
    expect(validatePassword('abcd123456', 'test@kangwon.ac.kr')).toBe('');
  });

  it('email 미전달 시 이메일 비교 스킵', () => {
    expect(validatePassword('abcd123456')).toBe('');
  });

  it('순수 한글 password를 거절한다', () => {
    expect(validatePassword('강원대학교기숙사생활')).toBeTruthy();
  });

  it('문자 조합 규칙 없이 10자 ASCII password를 허용한다', () => {
    expect(validatePassword('correcthorse')).toBe('');
  });

  it('9자는 새 비밀번호 최소 길이 미달로 거절한다', () => {
    expect(validatePassword('abcde1234')).toBeTruthy();
  });

  it('ASCII 외 문자는 문자 종류와 관계없이 거절한다', () => {
    expect(validatePassword('Passwordé2026')).toBeTruthy();
    expect(validatePassword('Password🏠2026')).toBeTruthy();
    expect(validatePassword('Ｐassword2026')).toBeTruthy();
  });

  it('ASCII와 Unicode whitespace를 모두 거절한다', () => {
    expect(validatePassword('Password 2026')).toBeTruthy();
    expect(validatePassword('Password\t2026')).toBeTruthy();
    expect(validatePassword('Password\n2026')).toBeTruthy();
    expect(validatePassword('Password\u00a02026')).toBeTruthy();
    expect(validatePassword('Password\u30002026')).toBeTruthy();
  });
});

describe('password structure result', () => {
  it('신규 비밀번호 거절 이유를 stable code로 구분한다', () => {
    expect(parseNewPasswordStructure('Password 2026')).toMatchObject({
      ok: false,
      code: 'WHITESPACE_NOT_ALLOWED',
    });
    expect(parseNewPasswordStructure('Passwordé2026')).toMatchObject({
      ok: false,
      code: 'INVALID_CHARACTERS',
    });
    expect(parseNewPasswordStructure('abcde1234')).toMatchObject({
      ok: false,
      code: 'TOO_SHORT',
    });
    expect(parseNewPasswordStructure('knuStudent', 'knuStudent@kangwon.ac.kr')).toMatchObject({
      ok: false,
      code: 'MATCHES_EMAIL',
    });
  });

  it('login 입력 guard는 신규 비밀번호 최소 길이나 조합을 재강제하지 않는다', () => {
    expect(parseLoginPasswordInput('pw')).toEqual({ ok: true });
    expect(parseLoginPasswordInput('Password 2026')).toMatchObject({
      ok: false,
      code: 'WHITESPACE_NOT_ALLOWED',
    });
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

  it('시각적으로 비슷해도 다른 code point는 일치로 처리하지 않는다', () => {
    expect(validatePasswordConfirm('Password2026', 'Ｐassword2026')).toBeTruthy();
  });
});

describe('validateNickname', () => {
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

  it('영문 닉네임 -> 통과', () => {
    expect(validateNickname('roommate')).toBe('');
  });

  it('숫자 포함 -> 통과', () => {
    expect(validateNickname('유저123')).toBe('');
  });

  it('한글+영문 혼합 -> 에러', () => {
    expect(validateNickname('룸메abc1')).toBe('한글과 영문은 함께 사용할 수 없어요.');
  });

  it('숫자로만 구성 -> 에러', () => {
    expect(validateNickname('1234')).toBeTruthy();
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

  it('앞뒤 공백 -> trim 후 통과', () => {
    expect(validateNickname('  곰두리  ')).toBe('');
  });

  it('공백만 입력 -> 에러', () => {
    expect(validateNickname('   ')).toBeTruthy();
  });

  it('예약어/금지어는 FE 구조 검증 대상이 아니라 통과한다', () => {
    expect(validateNickname('관리자')).toBe('');
    expect(validateNickname('섹스')).toBe('');
  });
});
