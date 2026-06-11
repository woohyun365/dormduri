export function isSelfSupportTicket(input: { requesterUserId: string; actorUserId: string }) {
  return input.requesterUserId === input.actorUserId;
}
