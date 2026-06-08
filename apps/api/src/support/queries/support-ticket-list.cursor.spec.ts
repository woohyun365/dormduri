import {
  decodeSupportTicketCursor,
  encodeSupportTicketCursor,
} from './support-ticket-list.cursor.js';

describe('support ticket list cursor', () => {
  it('lastMessageAt/id cursor를 round-trip 한다', () => {
    const cursor = encodeSupportTicketCursor({
      id: 'ticket-1',
      lastMessageAt: new Date('2026-06-08T00:00:00.000Z'),
    });

    expect(decodeSupportTicketCursor(cursor)).toEqual({
      id: 'ticket-1',
      lastMessageAt: new Date('2026-06-08T00:00:00.000Z'),
    });
  });

  it('잘못된 cursor는 null로 degrade 한다', () => {
    expect(decodeSupportTicketCursor('not-base64')).toBeNull();
    expect(decodeSupportTicketCursor(null)).toBeNull();
  });
});
