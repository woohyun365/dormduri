export function authContext(userId: string) {
  return {
    id: userId,
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };
}
