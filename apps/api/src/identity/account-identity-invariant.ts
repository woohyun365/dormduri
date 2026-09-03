export type AccountIdentityInvariantSurface =
  'current-user' | 'registration-finalize' | 'public-target-snapshot';

export type AccountIdentityInvariantCode =
  'USER_DISPLAY_IDENTITY_REQUIRED' | 'USER_ACADEMIC_IDENTITY_REQUIRED';

export type UserAccountIdentityContainer = {
  displayIdentity?: object | null;
  academicIdentity?: object | null;
};

export function hasUserDisplayIdentity<T extends { displayIdentity?: object | null }>(
  user: T | null | undefined,
): user is T & { displayIdentity: NonNullable<T['displayIdentity']> } {
  return Boolean(user?.displayIdentity);
}

export function hasUserAcademicIdentity<T extends { academicIdentity?: object | null }>(
  user: T | null | undefined,
): user is T & { academicIdentity: NonNullable<T['academicIdentity']> } {
  return Boolean(user?.academicIdentity);
}

export function assertUserDisplayIdentity<T extends { displayIdentity?: object | null }>(
  user: T,
  errorFactory: () => Error,
): asserts user is T & { displayIdentity: NonNullable<T['displayIdentity']> } {
  if (!hasUserDisplayIdentity(user)) {
    throw errorFactory();
  }
}

export function assertUserAcademicIdentity<T extends { academicIdentity?: object | null }>(
  user: T,
  errorFactory: () => Error,
): asserts user is T & { academicIdentity: NonNullable<T['academicIdentity']> } {
  if (!hasUserAcademicIdentity(user)) {
    throw errorFactory();
  }
}

export function assertUserAccountIdentity<T extends UserAccountIdentityContainer>(
  user: T,
  errorFactory: (invariant: AccountIdentityInvariantCode) => Error,
): asserts user is T & {
  displayIdentity: NonNullable<T['displayIdentity']>;
  academicIdentity: NonNullable<T['academicIdentity']>;
} {
  assertUserDisplayIdentity(user, () => errorFactory('USER_DISPLAY_IDENTITY_REQUIRED'));
  assertUserAcademicIdentity(user, () => errorFactory('USER_ACADEMIC_IDENTITY_REQUIRED'));
}
