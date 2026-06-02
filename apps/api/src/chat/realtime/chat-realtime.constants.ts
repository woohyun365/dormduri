export const CHAT_REALTIME_NAMESPACE = '/chat';
export const CHAT_REALTIME_TICKET_TTL_SECONDS = 60;
export const CHAT_REALTIME_TICKET_SCOPE = 'chat:realtime';

export const CHAT_REALTIME_EVENT_NAME = 'chat.event';
export const CHAT_REALTIME_ERROR_EVENT_NAME = 'chat.error';
export const CHAT_REALTIME_THREAD_SUBSCRIBE_EVENT = 'chat.thread.subscribe';
export const CHAT_REALTIME_THREAD_UNSUBSCRIBE_EVENT = 'chat.thread.unsubscribe';

export function chatRealtimeUserRoom(userId: string) {
  return `user:${userId}`;
}

export function chatRealtimeThreadRoom(threadId: string) {
  return `thread:${threadId}`;
}
