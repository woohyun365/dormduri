// Structural namespace only. Runtime/model admission requires later live validation.
export const CLAUDE_ADAPTER_READINESS = Object.freeze({
  host: 'claude-code',
  admission: 'unsupported',
  runtimeSupport: 'unknown',
  applied: false,
});
