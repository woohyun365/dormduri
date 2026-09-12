import type { AbstractHttpAdapter } from '@nestjs/core';
import type { Response } from 'express';

export function writeApiErrorResponse(
  adapter: AbstractHttpAdapter,
  response: unknown,
  body: { statusCode: number },
): void {
  const contentType: unknown = adapter.getHeader(response, 'Content-Type');
  if (
    typeof contentType === 'string' &&
    !contentType.startsWith('application/json') &&
    body.statusCode >= 400
  ) {
    // ExpressAdapter.reply rewrites this media type and adds a warning. Keep the
    // existing native JSON write for pre-set non-JSON errors (including metrics).
    adapter.status(response, body.statusCode);
    (response as Response).json(body);
    return;
  }

  adapter.reply(response, body, body.statusCode);
}
