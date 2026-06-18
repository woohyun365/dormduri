export type SesEmailErrorCategory =
  | 'CONFIG_INVALID'
  | 'ACCESS_DENIED'
  | 'MESSAGE_REJECTED'
  | 'THROTTLED'
  | 'TRANSIENT'
  | 'UNKNOWN';

export class SesEmailSenderError extends Error {
  readonly providerErrorCategory: SesEmailErrorCategory;

  constructor(category: SesEmailErrorCategory, message?: string, cause?: unknown) {
    super(message ?? `SES email send failed: ${category}`, { cause });
    this.name = 'SesEmailSenderError';
    this.providerErrorCategory = category;
  }
}

export function isEmailProviderCategorizedError(
  error: unknown,
): error is { providerErrorCategory: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'providerErrorCategory' in error &&
    typeof (error as { providerErrorCategory?: unknown }).providerErrorCategory === 'string'
  );
}

export function mapSesEmailErrorCategory(error: unknown): SesEmailErrorCategory {
  const name = readErrorName(error);

  switch (name) {
    case 'AccessDeniedException':
    case 'CredentialsProviderError':
    case 'ExpiredTokenException':
    case 'InvalidAccessKeyId':
    case 'InvalidClientTokenId':
    case 'SignatureDoesNotMatch':
    case 'UnrecognizedClientException':
      return 'ACCESS_DENIED';
    case 'BadRequestException':
    case 'NotFoundException':
      return 'CONFIG_INVALID';
    case 'AccountSuspendedException':
    case 'MailFromDomainNotVerifiedException':
    case 'MessageRejected':
    case 'SendingPausedException':
      return 'MESSAGE_REJECTED';
    case 'LimitExceededException':
    case 'ThrottlingException':
    case 'TooManyRequestsException':
      return 'THROTTLED';
    case 'AbortError':
    case 'InternalFailure':
    case 'InternalServerException':
    case 'NetworkingError':
    case 'RequestTimeout':
    case 'ServiceUnavailableException':
    case 'TimeoutError':
      return 'TRANSIENT';
    default:
      return 'UNKNOWN';
  }
}

export function toSesEmailSenderError(error: unknown): SesEmailSenderError {
  if (error instanceof SesEmailSenderError) {
    return error;
  }

  const category = mapSesEmailErrorCategory(error);
  return new SesEmailSenderError(category, `SES email send failed: ${category}`, error);
}

function readErrorName(error: unknown) {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim();
    }
  }

  return 'UNKNOWN';
}
