import type { ConfigFactory } from '@nestjs/config';
import type { EnvKeyDefinition } from './env-key.definition.js';
import type { EnvSchemaDefinition } from './joi-helpers.js';

export type NamedConfigFactory = ConfigFactory & {
  readonly KEY: string | symbol;
};

export interface ApiConfigSlice {
  readonly owner: string;
  readonly factory?: NamedConfigFactory;
  readonly schema: EnvSchemaDefinition;
  readonly envKeys: readonly EnvKeyDefinition[];
}

export function defineApiConfigSlice<const T extends ApiConfigSlice>(slice: T): T {
  return slice;
}
