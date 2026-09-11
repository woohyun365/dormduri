import type { PipeTransform } from '@nestjs/common';

/** Runs an existing synchronous request parser in Nest's parameter lifecycle. */
export class ZodRequestPipe<Input, Output> implements PipeTransform<Input, Output> {
  constructor(private readonly parse: (input: Input) => Output) {}

  transform(value: Input): Output {
    return this.parse(value);
  }
}
