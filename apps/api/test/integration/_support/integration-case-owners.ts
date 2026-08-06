export function resolveIntegrationCaseOwners<T extends string>(
  input: T | readonly T[],
): { owners: ReadonlySet<T>; label: string } {
  const values = typeof input === 'string' ? [input] : [...input];
  if (values.length === 0) {
    throw new Error('[integration-cases] at least one case owner is required');
  }

  return {
    owners: new Set(values),
    label: values.join(', '),
  };
}
