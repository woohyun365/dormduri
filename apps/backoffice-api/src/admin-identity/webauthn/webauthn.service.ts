import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_WEBAUTHN_RP_ID,
  BACKOFFICE_WEBAUTHN_RP_NAME,
} from '../../platform/config/backoffice-settings.js';

/** Five minutes for a passkey ceremony; the challenge row expires at the same time (README §3). */
export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60_000;

export interface StoredPasskey {
  readonly credentialId: string;
  readonly publicKey: Uint8Array;
  readonly counter: bigint;
  readonly transports: readonly string[];
}

export interface VerifiedRegistration {
  readonly credentialId: string;
  readonly publicKey: Uint8Array;
  readonly counter: number;
  readonly transports: string[];
  readonly deviceType: 'singleDevice' | 'multiDevice';
  readonly backedUp: boolean;
}

/**
 * SimpleWebAuthn 14 with the backoffice values: RP ID `localhost`, origin `http://localhost:4300`,
 * attestation `none`, discoverable credential preferred, user verification required (README §3).
 */
export class WebAuthnService {
  async registrationOptions(input: {
    accountId: string;
    userName: string;
    userDisplayName: string;
    excludeCredentialIds: readonly string[];
  }): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return generateRegistrationOptions({
      rpName: BACKOFFICE_WEBAUTHN_RP_NAME,
      rpID: BACKOFFICE_WEBAUTHN_RP_ID,
      userName: input.userName,
      userID: new TextEncoder().encode(input.accountId),
      userDisplayName: input.userDisplayName,
      timeout: WEBAUTHN_CHALLENGE_TTL_MS,
      attestationType: 'none',
      excludeCredentials: input.excludeCredentialIds.map((id) => ({ id })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
    });
  }

  async verifyRegistration(
    response: RegistrationResponseJSON,
    expectedChallenge: string,
  ): Promise<VerifiedRegistration | null> {
    try {
      const result = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: BACKOFFICE_ORIGIN,
        expectedRPID: BACKOFFICE_WEBAUTHN_RP_ID,
        requireUserVerification: true,
      });
      if (!result.verified) {
        return null;
      }
      const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
      return {
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports ?? response.response.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      };
    } catch {
      return null;
    }
  }

  async authenticationOptions(
    credentialIds: readonly string[],
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return generateAuthenticationOptions({
      rpID: BACKOFFICE_WEBAUTHN_RP_ID,
      allowCredentials: credentialIds.map((id) => ({ id })),
      timeout: WEBAUTHN_CHALLENGE_TTL_MS,
      userVerification: 'required',
    });
  }

  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
    passkey: StoredPasskey,
  ): Promise<{ newCounter: number } | null> {
    try {
      const result = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: BACKOFFICE_ORIGIN,
        expectedRPID: BACKOFFICE_WEBAUTHN_RP_ID,
        requireUserVerification: true,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: Number(passkey.counter),
          transports: [...passkey.transports],
        },
      });
      return result.verified && result.authenticationInfo.userVerified
        ? { newCounter: result.authenticationInfo.newCounter }
        : null;
    } catch {
      return null;
    }
  }
}
