import Joi from 'joi';
import { appEnvSchema } from './schema/app.schema.js';
import { authEnvSchema } from './schema/auth.schema.js';
import { databaseEnvSchema } from './schema/database.schema.js';
import { emailEnvSchema } from './schema/email.schema.js';
import { httpEnvSchema } from './schema/http.schema.js';
import { lifecycleEnvSchema } from './schema/lifecycle.schema.js';
import { observabilityEnvSchema } from './schema/observability.schema.js';
import { paginationEnvSchema } from './schema/pagination.schema.js';
import { realtimeEnvSchema } from './schema/realtime.schema.js';
import { retentionEnvSchema } from './schema/retention.schema.js';
import { secretSourceEnvSchema } from './schema/secret-source.schema.js';

export const envValidationSchema = Joi.object({
  ...appEnvSchema,
  ...databaseEnvSchema,
  ...observabilityEnvSchema,
  ...authEnvSchema,
  ...emailEnvSchema,
  ...httpEnvSchema,
  ...realtimeEnvSchema,
  ...lifecycleEnvSchema,
  ...retentionEnvSchema,
  ...paginationEnvSchema,
  ...secretSourceEnvSchema,
}).unknown(true);
