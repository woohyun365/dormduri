export function redactStressEvidence(value) {
  return String(value)
    .replace(/postgresql:\/\/[^\s)]+/giu, 'postgresql://[REDACTED_STRESS_SECRET]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [REDACTED_STRESS_SECRET]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[REDACTED_STRESS_SECRET]')
    .replace(/(TOKEN|SECRET|PASSWORD|DATABASE_URL)=([^\s]+)/giu, '$1=[REDACTED_STRESS_SECRET]');
}

export function escapeStressTableCell(value) {
  return redactStressEvidence(value).replace(/\|/gu, '\\|').replace(/\n/gu, '<br>');
}
