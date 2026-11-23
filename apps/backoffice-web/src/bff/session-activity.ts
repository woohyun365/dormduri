/**
 * Response header the BFF sets when the backoffice API answered a request carrying the session (the
 * API moves the session's last activity on every such request, permission refusals included). The
 * page restarts its idle countdown only on this header, never on a refusal the BFF gave on its own
 * or on an API it could not reach.
 */
export const SESSION_ACTIVITY_HEADER = 'x-backoffice-session-activity';
