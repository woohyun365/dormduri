import { defineEnvKeys } from '../../config/environment/env-key.definition.js';
import {
  productionRequiredString,
  type EnvSchemaDefinition,
} from '../../config/environment/joi-helpers.js';
import {
  DEFAULT_ROOMMATE_SEARCH_CURSOR_HMAC_SECRET,
  ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV,
} from '../pagination/roommate-search-token.codec.js';

export const roommateSearchEnvSchema = {
  [ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV]: productionRequiredString({
    nonProductionDefault: DEFAULT_ROOMMATE_SEARCH_CURSOR_HMAC_SECRET,
    forbidProductionPlaceholder: true,
  }),
} satisfies EnvSchemaDefinition;

export const roommateSearchEnvKeys = defineEnvKeys([
  {
    key: ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV,
    owner: 'roommate-search',
    category: 'pagination',
    source: 'secret-store',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    secret: true,
    forbidProductionPlaceholder: true,
    description: 'HMAC secret for roommate-search cursor tokens.',
  },
] as const);
