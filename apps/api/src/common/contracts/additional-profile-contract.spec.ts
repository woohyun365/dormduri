import {
  additionalProfileSchema,
  profileBirthYearSchema,
  profileGradeSchema,
  profileMbtiSchema,
} from '@repo/shared/profile-contract';

describe('additional profile contract', () => {
  it('grade는 허용된 4개 값만 통과한다', () => {
    expect(profileGradeSchema.parse('1')).toBe('1');
    expect(profileGradeSchema.safeParse('5').success).toBe(false);
  });

  it('mbti canonical value는 uppercase 4글자 형식만 허용한다', () => {
    expect(profileMbtiSchema.parse('ENFP')).toBe('ENFP');
    expect(profileMbtiSchema.safeParse('ABCD').success).toBe(false);
    expect(profileMbtiSchema.safeParse(' enfp ').success).toBe(false);
  });

  it('birthYear는 1980 미만을 거부한다', () => {
    expect(profileBirthYearSchema.parse(2001)).toBe(2001);
    expect(profileBirthYearSchema.safeParse(1979).success).toBe(false);
    expect(
      additionalProfileSchema.safeParse({
        college: null,
        grade: null,
        mbti: null,
        birthYear: 1979,
      }).success,
    ).toBe(false);
  });
});
