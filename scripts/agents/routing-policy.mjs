const ROUTES = {
  lookup: { role: 'explore', effort: 'low' },
  analysis: { role: 'analyst', effort: 'medium' },
  implementation: { role: 'executor', effort: 'medium' },
  debugging: { role: 'debugger', effort: 'high' },
  test: { role: 'test-engineer', effort: 'medium' },
  research: { role: 'researcher', effort: 'high' },
  verification: { role: 'verifier', effort: 'high' },
  architecture: { role: 'architect', effort: 'high' },
  review: { role: 'code-reviewer', effort: 'high' },
};

const RISKS = new Set(['normal', 'low', 'medium', 'high', 'critical']);
const HIGH_RISK_KINDS = new Set([
  'analysis',
  'architecture',
  'debugging',
  'implementation',
  'review',
  'test',
]);

export function selectAgentRoute({
  taskKind,
  risk = 'normal',
  independent = true,
  roleRoutingAvailable = true,
}) {
  if (!(taskKind in ROUTES)) throw new Error(`Unsupported task kind: ${taskKind}`);
  if (!RISKS.has(risk)) throw new Error(`Unsupported task risk: ${risk}`);
  if (typeof independent !== 'boolean') throw new TypeError('independent must be a boolean.');
  if (typeof roleRoutingAvailable !== 'boolean') {
    throw new TypeError('roleRoutingAvailable must be a boolean.');
  }

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
  if (['high', 'critical'].includes(risk) && HIGH_RISK_KINDS.has(taskKind)) {
    route.effort = 'high';
  }
  if (risk === 'critical' && taskKind === 'architecture') route.effort = 'xhigh';

  return {
    spawn: true,
    ...route,
    execution: 'bounded-child',
    reason: `Independent ${taskKind} lane with a verified role route.`,
  };
}
