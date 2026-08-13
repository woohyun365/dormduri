const ROUTES = {
  lookup: { role: 'explore', effort: 'low' },
  implementation: { role: 'executor', effort: 'medium' },
  test: { role: 'test-engineer', effort: 'medium' },
  research: { role: 'researcher', effort: 'high' },
  verification: { role: 'verifier', effort: 'high' },
  architecture: { role: 'architect', effort: 'high' },
};

const HIGH_RISK_KINDS = new Set(['architecture', 'test']);

export function selectAgentRoute({
  taskKind,
  risk = 'normal',
  independent = true,
  roleRoutingAvailable = true,
}) {
  if (!(taskKind in ROUTES)) throw new Error(`Unsupported task kind: ${taskKind}`);

  if (!independent) {
    return {
      spawn: false,
      role: null,
      effort: null,
      execution: 'single-sequential',
      reason: 'The task shares a dependency chain or write owner with the leader.',
    };
  }

  if (!roleRoutingAvailable) {
    return {
      spawn: false,
      role: null,
      effort: null,
      execution: 'single-sequential',
      reason: 'The native surface cannot prove installed role routing.',
    };
  }

  const route = { ...ROUTES[taskKind] };
  if (risk === 'high' && HIGH_RISK_KINDS.has(taskKind)) route.effort = 'high';
  if (risk === 'critical' && taskKind === 'architecture') route.effort = 'xhigh';

  return {
    spawn: true,
    ...route,
    execution: 'bounded-child',
    reason: `Independent ${taskKind} lane with a verified role route.`,
  };
}
