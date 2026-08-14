import { AuthenticatedUserGuard } from '../access/authenticated-user.guard.js';
import { AuthActorContextResolver } from '../application/auth-actor-context.resolver.js';
import { AuthPasswordVerifier } from '../application/auth-password-verifier.service.js';
import { AuthService } from '../application/auth.service.js';

export const AUTH_EXPORTS = [
  AuthService,
  AuthActorContextResolver,
  AuthPasswordVerifier,
  AuthenticatedUserGuard,
];
