// Static contract only. Runtime/model admission still requires later live validation.
export const CLAUDE_ADAPTER_READINESS = Object.freeze({
  host: 'claude-code',
  admission: 'unsupported',
  runtimeSupport: 'unknown',
  applied: false,
});

export {
  assessClaudeModelObservation,
  assessClaudeStaticExchange,
  assessClaudeSubagentAdmission,
  createClaudeSubagentBinding,
  evaluateClaudeProfileEligibility,
  listClaudeSubagentProfiles,
} from './model-policy.mjs';

export { runClaudePreflight } from './session-preflight.mjs';
export { prepareClaudeWorkflow, validateClaudeWorkflowResults } from './workflow-entry.mjs';
