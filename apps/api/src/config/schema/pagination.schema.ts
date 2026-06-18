import { CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV } from '../../chat/queries/chat-thread-list-cursor.js';
import { DEFAULT_CHAT_THREAD_LIST_CURSOR_HMAC_SECRET } from '../../chat/queries/chat-thread-list-cursor.js';
import {
  DEFAULT_PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET,
  DEFAULT_ROOMMATE_SEARCH_CURSOR_HMAC_SECRET,
  PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV,
  ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV,
} from '../../roommate-search/pagination/roommate-search-token.codec.js';
import { productionRequiredString, type EnvSchemaDefinition } from './joi-helpers.js';

export const paginationEnvSchema = {
  [ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV]: productionRequiredString({
    nonProductionDefault: DEFAULT_ROOMMATE_SEARCH_CURSOR_HMAC_SECRET,
    forbidProductionPlaceholder: true,
  }),
  [PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV]: productionRequiredString({
    nonProductionDefault: DEFAULT_PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET,
    forbidProductionPlaceholder: true,
  }),
  [CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV]: productionRequiredString({
    nonProductionDefault: DEFAULT_CHAT_THREAD_LIST_CURSOR_HMAC_SECRET,
    forbidProductionPlaceholder: true,
  }),
} satisfies EnvSchemaDefinition;
