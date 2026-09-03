export type EnvKeyOwner =
  | 'platform-runtime'
  | 'platform-http'
  | 'platform-database'
  | 'platform-observability'
  | 'auth'
  | 'auth-operations'
  | 'auth-mail'
  | 'chat-realtime'
  | 'lifecycle'
  | 'retention'
  | 'roommate-search'
  | 'profiles'
  | 'chat';

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
  'required' | 'production-required' | 'optional' | 'safe-local-default';

export type EnvDeploymentScope = 'runtime' | 'migration';

export interface EnvKeyDefinition {
  readonly key: string;
  readonly owner: EnvKeyOwner;
  readonly category: EnvKeyCategory;
  readonly source: EnvKeySource;
  readonly defaultPolicy: EnvDefaultPolicy;
  readonly description: string;
  readonly deploymentScope?: EnvDeploymentScope;
  readonly requiredInProduction?: boolean;
  readonly requiredForDeployment?: boolean;
  readonly targetRequired?: boolean;
  readonly secret?: boolean;
  readonly placeholderAllowed?: boolean;
  readonly forbidProductionPlaceholder?: boolean;
}

export function defineEnvKeys<const T extends readonly EnvKeyDefinition[]>(keys: T): T {
  return keys;
}
