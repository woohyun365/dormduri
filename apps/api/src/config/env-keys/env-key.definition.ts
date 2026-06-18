export type EnvKeyOwner =
  | 'app'
  | 'http'
  | 'database'
  | 'observability'
  | 'auth'
  | 'email'
  | 'realtime'
  | 'lifecycle'
  | 'retention'
  | 'roommateSearch'
  | 'profile'
  | 'chat'
  | 'secrets';

export type EnvKeyCategory =
  | 'runtime'
  | 'secret'
  | 'database'
  | 'ingress'
  | 'email'
  | 'observability'
  | 'retention'
  | 'pagination'
  | 'feature';

export type EnvKeySource = 'process-env' | 'secret-store' | 'runtime-default';

export type EnvDefaultPolicy =
  | 'required'
  | 'production-required'
  | 'optional'
  | 'safe-local-default';

export interface EnvKeyDefinition {
  readonly key: string;
  readonly owner: EnvKeyOwner;
  readonly category: EnvKeyCategory;
  readonly source: EnvKeySource;
  readonly defaultPolicy: EnvDefaultPolicy;
  readonly description: string;
  readonly requiredInProduction?: boolean;
  readonly secret?: boolean;
  readonly placeholderAllowed?: boolean;
  readonly forbidProductionPlaceholder?: boolean;
}

export function defineEnvKeys<const T extends readonly EnvKeyDefinition[]>(keys: T): T {
  return keys;
}
