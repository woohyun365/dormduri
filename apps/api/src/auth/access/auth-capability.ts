export const AUTH_CAPABILITIES = {
  USER_READ_SELF: 'user:read:self',
  USER_UPDATE_SELF: 'user:update:self',
  AUTH_SESSION_REVOKE_SELF: 'auth:session:revoke:self',
  AUTH_PASSWORD_CHANGE_SELF: 'auth:password:change:self',
} as const;

export type AuthSelfServiceCapability = (typeof AUTH_CAPABILITIES)[keyof typeof AUTH_CAPABILITIES];

export type AuthCapability = AuthSelfServiceCapability | `admin:${string}`;

export const SELF_SERVICE_AUTH_CAPABILITIES = Object.freeze([
  AUTH_CAPABILITIES.USER_READ_SELF,
  AUTH_CAPABILITIES.USER_UPDATE_SELF,
  AUTH_CAPABILITIES.AUTH_SESSION_REVOKE_SELF,
  AUTH_CAPABILITIES.AUTH_PASSWORD_CHANGE_SELF,
] satisfies readonly AuthCapability[]);
