import {
  additionalProfileSchema,
  profileBirthYearSchema,
  profileGradeSchema,
  profileMbtiInputSchema,
  profileMbtiSchema,
} from '@repo/shared/profile-contract';
import { additionalProfilePatchSchema } from '@repo/shared/user-contract';

describe('additional profile contract', () => {
  it('grade는 허용된 4개 값만 통과한다', () => {
    expect(profileGradeSchema.parse('1')).toBe('1');
    expect(profileGradeSchema.safeParse('5').success).toBe(false);
    expect(
      additionalProfilePatchSchema.safeParse({
        grade: '5',
      }).success,
    ).toBe(false);
  });

  it('mbti patch input은 trim + uppercase normalize 후 검증한다', () => {
    expect(profileMbtiInputSchema.parse(' enfp ')).toBe('ENFP');
    expect(profileMbtiSchema.safeParse('ABCD').success).toBe(false);
    expect(
      additionalProfilePatchSchema.safeParse({
        mbti: ' enfp ',
      }).data,
    ).toEqual({ mbti: 'ENFP' });
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
