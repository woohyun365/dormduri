import { createHmac, timingSafeEqual } from 'node:crypto';

export class OpaqueTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpaqueTokenError';
  }
}

export function signOpaqueHmacToken(payload: unknown, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifyOpaqueHmacToken(token: string, secret: string): unknown {
  const [encodedPayload, signature, unexpected] = token.split('.');
  if (!encodedPayload || !signature || unexpected !== undefined) {
    throw new OpaqueTokenError('Malformed opaque token.');
  }

  const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  if (!safeEqual(signature, expectedSignature)) {
    throw new OpaqueTokenError('Invalid opaque token signature.');
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new OpaqueTokenError('Invalid opaque token payload.');
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
