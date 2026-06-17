import Joi, { type CustomHelpers, type Schema, type StringSchema } from 'joi';

export type EnvSchemaDefinition = Record<string, Schema>;

const booleanTruthyValues = ['1', 'true', 'yes', 'on'] as const;
const booleanFalsyValues = ['0', 'false', 'no', 'off'] as const;

export function booleanEnv(defaultValue: boolean): Schema {
  return booleanTruthyValues
    .reduce((schema, value) => schema.truthy(value), Joi.boolean())
    .concat(booleanFalsyValues.reduce((schema, value) => schema.falsy(value), Joi.boolean()))
    .default(defaultValue);
}

export function numberEnv(defaultValue: number, options: { min?: number } = {}): Schema {
  let schema = Joi.number().integer();
  if (options.min !== undefined) {
    schema = schema.min(options.min);
  }
  return schema.default(defaultValue);
}

export function optionalTrimmedString(): StringSchema {
  return Joi.string().trim().optional();
}

export function productionRequiredString(options: {
  nonProductionDefault?: string;
  base64?: boolean;
  forbidProductionPlaceholder?: boolean;
}): Schema {
  const productionSchema = withProductionPlaceholderGuard(
    options.base64 === true ? Joi.string().base64() : Joi.string().trim(),
    options.forbidProductionPlaceholder === true,
  ).required();

  const nonProductionSchema = options.base64 === true ? Joi.string().base64() : Joi.string().trim();

  return (options.base64 === true ? Joi.string().base64() : Joi.string().trim()).when('NODE_ENV', {
    is: 'production',
    then: productionSchema,
    otherwise:
      options.nonProductionDefault === undefined
        ? nonProductionSchema.optional()
        : nonProductionSchema.default(options.nonProductionDefault),
  });
}

export function stringWhenProviderIsSes(): Schema {
  return withProductionPlaceholderGuard(Joi.string().trim(), true).when('EMAIL_PROVIDER', {
    is: 'ses',
    then: Joi.required(),
    otherwise: Joi.optional(),
  });
}

export function emailWhenProviderIsSes(): Schema {
  return withProductionPlaceholderGuard(Joi.string().trim().email({ tlds: false }), true).when(
    'EMAIL_PROVIDER',
    {
      is: 'ses',
      then: Joi.required(),
      otherwise: Joi.optional(),
    },
  );
}

export function optionalEmailString(): Schema {
  return Joi.string().trim().email({ tlds: false }).optional();
}

function withProductionPlaceholderGuard<T extends StringSchema>(schema: T, enabled: boolean): T {
  if (!enabled) {
    return schema;
  }

  return schema.custom(rejectProductionPlaceholderOrLocalDefault, 'production placeholder guard');
}

function rejectProductionPlaceholderOrLocalDefault(value: string, helpers: CustomHelpers): string {
  const root = getValidationRoot(helpers);
  if (root.NODE_ENV !== 'production') {
    return value;
  }

  if (isForbiddenProductionValue(value)) {
    return helpers.error('any.invalid') as never;
  }

  return value;
}

function getValidationRoot(helpers: CustomHelpers): Record<string, unknown> {
  const ancestors = helpers.state.ancestors as unknown[];
  const root = ancestors[0];
  return isRecord(root) ? root : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isForbiddenProductionValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }

  if (
    normalized === 'REPLACE_ME' ||
    normalized.startsWith('REPLACE_WITH_') ||
    normalized.includes(':REPLACE_ME@') ||
    normalized.includes('REPLACE_WITH_')
  ) {
    return true;
  }

  if (
    normalized.includes('localhost') ||
    normalized.includes('127.0.0.1') ||
    normalized.includes('0.0.0.0')
  ) {
    return true;
  }

  return (
    normalized.startsWith('local-') ||
    normalized.includes('local-') ||
    normalized.includes('_local_')
  );
}
