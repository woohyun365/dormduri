'use client';

import ChatTab from '@/main/tabs/chat/ChatTab';
import { useMainShell } from '@/main/runtime/MainContexts';

export default function ChatRoute() {
  const { viewer, navigate } = useMainShell();
  // A season-only update must not discard a conversation or its unsent draft.
  return <ChatTab key={viewer.id} viewerId={viewer.id} onNavigate={navigate} />;
}
