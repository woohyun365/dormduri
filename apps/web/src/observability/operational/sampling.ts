export function stableOperationalSample(seed: string, rate: number): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;

  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff < rate;
}
