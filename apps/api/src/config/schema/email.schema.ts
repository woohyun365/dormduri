import Joi from 'joi';
import { DEFAULT_EMAIL_PROVIDER } from '../email.config.js';
import {
  emailWhenProviderIsSes,
  optionalEmailString,
  stringWhenProviderIsSes,
  type EnvSchemaDefinition,
} from './joi-helpers.js';

export const emailEnvSchema = {
  EMAIL_PROVIDER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('ses').required(),
    otherwise: Joi.string().valid('stub', 'ses').default(DEFAULT_EMAIL_PROVIDER),
  }),
  SES_REGION: stringWhenProviderIsSes(),
  SES_FROM_EMAIL: emailWhenProviderIsSes(),
  SES_FROM_NAME: Joi.string().trim().optional(),
  SES_REPLY_TO_EMAIL: optionalEmailString(),
  SES_CONFIGURATION_SET: Joi.string().trim().optional(),
} satisfies EnvSchemaDefinition;
