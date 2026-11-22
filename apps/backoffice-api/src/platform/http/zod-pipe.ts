import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { BackofficeApiError } from './api-error.js';

/** Validates a body or query with a shared contract schema; a mismatch is `invalid_request`. */
@Injectable()
export class ZodPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const parsed = this.schema.safeParse(value ?? {});
    if (!parsed.success) {
      throw new BackofficeApiError('invalid_request');
    }
    return parsed.data;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** Route id parameters are UUIDs (admin table ids are `@default(uuid())`). */
@Injectable()
export class UuidParamPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !UUID.test(value)) {
      throw new BackofficeApiError('not_found');
    }
    return value;
  }
}
