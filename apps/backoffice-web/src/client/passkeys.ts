import {
  startAuthentication,
  startRegistration,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import type {
  ReauthenticationResponse,
  WebAuthnChallengeResponse,
  WebAuthnOptions,
} from '@repo/shared/backoffice';
import { postBff, type BffResult } from './bff-client';

/**
 * Passkey ceremonies in the browser (`@simplewebauthn/browser`, D-BF3). The API builds the options
 * with SimpleWebAuthn and verifies the answer; the BFF has checked the options against the contract,
 * and the browser library validates every field before it calls `navigator.credentials`.
 */
export function createPasskey(options: WebAuthnOptions): Promise<RegistrationResponseJSON> {
  return startRegistration({
    optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
  });
}

export function signWithPasskey(options: WebAuthnOptions): Promise<AuthenticationResponseJSON> {
  return startAuthentication({
    optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
  });
}

export type PasskeyFailure = {
  readonly ok: false;
  readonly status: 0;
  readonly code: 'passkey_cancelled';
};

/** The browser refused or the operator cancelled; nothing was sent. */
export async function attempt<T>(
  ceremony: () => Promise<T>,
): Promise<{ ok: true; value: T } | PasskeyFailure> {
  try {
    return { ok: true, value: await ceremony() };
  } catch {
    return { ok: false, status: 0, code: 'passkey_cancelled' };
  }
}

/** Passkey re-authentication (5 minutes, OA-R4). */
export async function reauthenticate(): Promise<
  BffResult<ReauthenticationResponse> | PasskeyFailure
> {
  const options = await postBff<WebAuthnChallengeResponse>('/api/auth/reauthentication/options');
  if (!options.ok) return options;
  const signed = await attempt(() => signWithPasskey(options.data.options));
  if (!signed.ok) return signed;
  return postBff<ReauthenticationResponse>('/api/auth/reauthentication', {
    challengeId: options.data.challengeId,
    credential: signed.value,
  });
}

/**
 * Runs an action that may need a recent re-authentication; when the API asks for one, the operator
 * confirms with a passkey once and the action runs again.
 */
export async function withReauthentication<T>(
  action: () => Promise<BffResult<T>>,
): Promise<BffResult<T> | PasskeyFailure> {
  const first = await action();
  if (first.ok || first.code !== 'reauthentication_required') {
    return first;
  }
  const confirmed = await reauthenticate();
  if (!confirmed.ok) {
    return confirmed;
  }
  return action();
}
