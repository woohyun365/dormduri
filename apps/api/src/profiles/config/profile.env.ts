import { defineEnvKeys } from '../../config/environment/env-key.definition.js';
import {
  productionRequiredString,
  type EnvSchemaDefinition,
} from '../../config/environment/joi-helpers.js';
import {
  DEFAULT_PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET,
  PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV,
} from '../../roommate-search/pagination/roommate-search-token.codec.js';

export const profileEnvSchema = {
  [PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV]: productionRequiredString({
    nonProductionDefault: DEFAULT_PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET,
    forbidProductionPlaceholder: true,
  }),
} satisfies EnvSchemaDefinition;

export const profileEnvKeys = defineEnvKeys([
  {
    key: PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV,
    owner: 'profiles',
    category: 'pagination',
    source: 'secret-store',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    secret: true,
    forbidProductionPlaceholder: true,
    description: 'HMAC secret for profile detail entry tokens.',
  },
] as const);
