import { defineEnvKeys } from '../../config/environment/env-key.definition.js';
import {
  productionRequiredString,
  type EnvSchemaDefinition,
} from '../../config/environment/joi-helpers.js';
import {
  CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV,
  DEFAULT_CHAT_THREAD_LIST_CURSOR_HMAC_SECRET,
} from '../queries/chat-thread-list-cursor.js';

export const chatEnvSchema = {
  [CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV]: productionRequiredString({
    nonProductionDefault: DEFAULT_CHAT_THREAD_LIST_CURSOR_HMAC_SECRET,
    forbidProductionPlaceholder: true,
  }),
} satisfies EnvSchemaDefinition;

export const chatEnvKeys = defineEnvKeys([
  {
    key: CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV,
    owner: 'chat',
    category: 'pagination',
    source: 'secret-store',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    secret: true,
    forbidProductionPlaceholder: true,
    description: 'HMAC secret for chat thread list cursors.',
  },
] as const);
