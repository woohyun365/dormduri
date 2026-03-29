export const MATCH_SENT_OVERRIDE_KEY = 'devpanel-match-sent';
export const MATCH_RECEIVED_OVERRIDE_KEY = 'devpanel-match-received';
export const MATCH_CHATS_OVERRIDE_KEY = 'devpanel-match-chats';

export function readOptionalNumber(key: string): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(key);
  return raw !== null ? Number(raw) : null;
}

export function writeOptionalNumber(key: string, value: number | null): void {
  if (typeof window === 'undefined') return;
  if (value !== null) localStorage.setItem(key, String(value));
  else localStorage.removeItem(key);
}

export function readHomeMatchingSummaryOverrides() {
  return {
    sentRequests: readOptionalNumber(MATCH_SENT_OVERRIDE_KEY),
    receivedRequests: readOptionalNumber(MATCH_RECEIVED_OVERRIDE_KEY),
    activeChats: readOptionalNumber(MATCH_CHATS_OVERRIDE_KEY),
  };
}
