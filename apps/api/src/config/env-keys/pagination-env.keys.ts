import { defineEnvKeys } from './env-key.definition.js';

export const paginationEnvKeys = defineEnvKeys([
  {
    key: 'ROOMMATE_SEARCH_CURSOR_HMAC_SECRET',
    owner: 'roommateSearch',
    category: 'pagination',
    source: 'secret-store',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    secret: true,
    forbidProductionPlaceholder: true,
    description: 'HMAC secret for roommate-search cursor tokens.',
  },
  {
    key: 'PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET',
    owner: 'profile',
    category: 'pagination',
    source: 'secret-store',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    secret: true,
    forbidProductionPlaceholder: true,
    description: 'HMAC secret for profile detail entry tokens.',
  },
  {
    key: 'CHAT_THREAD_LIST_CURSOR_HMAC_SECRET',
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
