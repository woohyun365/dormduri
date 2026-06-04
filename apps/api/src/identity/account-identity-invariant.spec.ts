import {
  assertUserAccountIdentity,
  assertUserAcademicIdentity,
  assertUserDisplayIdentity,
  hasUserAcademicIdentity,
  hasUserDisplayIdentity,
} from './account-identity-invariant.js';

describe('account-identity-invariant', () => {
  it('detects display and academic identity presence independently', () => {
    expect(hasUserDisplayIdentity({ displayIdentity: { nickname: '가나다' } })).toBe(true);
    expect(hasUserDisplayIdentity({ displayIdentity: null })).toBe(false);
    expect(hasUserAcademicIdentity({ academicIdentity: { studentNumber: '20260001' } })).toBe(true);
    expect(hasUserAcademicIdentity({ academicIdentity: null })).toBe(false);
  });

  it('throws caller-provided errors for missing identity invariants', () => {
    expect(() =>
      assertUserDisplayIdentity({ displayIdentity: null }, () => new Error('display required')),
    ).toThrow('display required');
    expect(() =>
      assertUserAcademicIdentity({ academicIdentity: null }, () => new Error('academic required')),
    ).toThrow('academic required');
    expect(() =>
      assertUserAccountIdentity(
        { displayIdentity: { nickname: '가나다' }, academicIdentity: null },
        (invariant) => new Error(invariant),
      ),
    ).toThrow('USER_ACADEMIC_IDENTITY_REQUIRED');
  });

  it('passes when both account identity surfaces exist', () => {
    expect(() =>
      assertUserAccountIdentity(
        {
          displayIdentity: { nickname: '가나다' },
          academicIdentity: { studentNumber: '20260001' },
        },
        (invariant) => new Error(invariant),
      ),
    ).not.toThrow();
  });
});
