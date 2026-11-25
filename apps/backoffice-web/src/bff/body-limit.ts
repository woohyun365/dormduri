/**
 * The largest request body the BFF reads (README §3). The route wrapper stops reading past it, and the browser client
 * refuses to send a larger body so the operator learns the reason instead of a generic input failure.
 */
export const MAX_BFF_BODY_BYTES = 64 * 1024;
