import Joi from 'joi';
import { productionRequiredString, type EnvSchemaDefinition } from './joi-helpers.js';

export const retentionEnvSchema = {
  RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64: productionRequiredString({
    base64: true,
    forbidProductionPlaceholder: true,
  }),
  RETENTION_IDENTITY_KEY_VERSION: Joi.string().trim().default('local-v1'),
  RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64: productionRequiredString({
    base64: true,
    forbidProductionPlaceholder: true,
  }),
  RETENTION_VAULT_CHAT_BODY_KEY_VERSION: Joi.string().trim().default('local-v1'),
} satisfies EnvSchemaDefinition;
