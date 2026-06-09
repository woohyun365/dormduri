import { collegeCodeSchema, getCollegeLabel } from '@repo/shared/college';

describe('college contract', () => {
  it('arbitrary string college code를 거부한다', () => {
    expect(collegeCodeSchema.safeParse('CYBER_CULTURE').success).toBe(false);
  });

  it('known college code는 허용하고 label을 조회할 수 있다', () => {
    expect(collegeCodeSchema.parse('IT')).toBe('IT');
    expect(getCollegeLabel('IT')).toBe('IT대');
  });
});
