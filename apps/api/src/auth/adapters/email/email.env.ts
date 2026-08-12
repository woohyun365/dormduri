import Joi from 'joi';
import { defineEnvKeys } from '../../../config/environment/env-key.definition.js';
import { DEFAULT_EMAIL_PROVIDER } from './email.config.js';
import {
  emailWhenProviderIsSes,
  optionalEmailString,
  stringWhenProviderIsSes,
  type EnvSchemaDefinition,
} from '../../../config/environment/joi-helpers.js';

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

export const emailEnvKeys = defineEnvKeys([
  {
    key: 'EMAIL_PROVIDER',
    owner: 'auth-mail',
    category: 'email',
    source: 'process-env',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    description: 'Email provider selector. Production must use ses.',
  },
  {
    key: 'SES_REGION',
    owner: 'auth-mail',
    category: 'email',
    source: 'process-env',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    forbidProductionPlaceholder: true,
    description: 'AWS SES region used by the production email provider.',
  },
  {
    key: 'SES_FROM_EMAIL',
    owner: 'auth-mail',
    category: 'email',
    source: 'process-env',
    defaultPolicy: 'production-required',
    requiredInProduction: true,
    forbidProductionPlaceholder: true,
    description: 'Verified SES sender email address.',
  },
  {
    key: 'SES_FROM_NAME',
    owner: 'auth-mail',
    category: 'email',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Optional display name for SES sender.',
  },
  {
    key: 'SES_REPLY_TO_EMAIL',
    owner: 'auth-mail',
    category: 'email',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Optional reply-to email address for SES messages.',
  },
  {
    key: 'SES_CONFIGURATION_SET',
    owner: 'auth-mail',
    category: 'email',
    source: 'process-env',
    defaultPolicy: 'optional',
    description: 'Optional SES configuration set name.',
  },
] as const);
