export type UserDisplayIdentityContainer = {
  displayIdentity?: object | null;
};

export function hasUserDisplayIdentity<T extends UserDisplayIdentityContainer>(
  user: T | null | undefined,
): user is T & { displayIdentity: NonNullable<T['displayIdentity']> } {
  return Boolean(user?.displayIdentity);
}

export function assertUserDisplayIdentity<T extends UserDisplayIdentityContainer>(
  user: T,
  errorFactory: () => Error,
): asserts user is T & { displayIdentity: NonNullable<T['displayIdentity']> } {
  if (!hasUserDisplayIdentity(user)) {
    throw errorFactory();
  }
}
