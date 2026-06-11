export function resolveBearerAuthToken(authorization: string | undefined): string | null {
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
}
