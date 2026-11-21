import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_WEBAUTHN_RP_ID,
} from '../../src/platform/config/backoffice-settings.js';

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_ATTESTED_CREDENTIAL = 0x40;

const b64url = (bytes: Buffer | Uint8Array) => Buffer.from(bytes).toString('base64url');
const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest();

/**
 * A software passkey (ES256, `none` attestation) that answers SimpleWebAuthn options the way a
 * browser authenticator does. It stands in for the Chromium virtual authenticator the web e2e uses.
 */
export class SoftwareAuthenticator {
  readonly credentialId = randomBytes(32);
  private readonly privateKey: KeyObject;
  private readonly publicKeyCose: Uint8Array;
  private signCount = 0;

  constructor(
    private readonly options: { origin?: string; rpId?: string; userVerified?: boolean } = {},
  ) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = privateKey;
    const jwk = publicKey.export({ format: 'jwk' });
    this.publicKeyCose = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x!, 'base64url')],
        [-3, Buffer.from(jwk.y!, 'base64url')],
      ]),
    );
  }

  get id(): string {
    return b64url(this.credentialId);
  }

  private flags(extra = 0): number {
    return (
      FLAG_USER_PRESENT | (this.options.userVerified === false ? 0 : FLAG_USER_VERIFIED) | extra
    );
  }

  private clientData(type: 'webauthn.create' | 'webauthn.get', challenge: string): Buffer {
    return Buffer.from(
      JSON.stringify({
        type,
        challenge,
        origin: this.options.origin ?? BACKOFFICE_ORIGIN,
        crossOrigin: false,
      }),
      'utf8',
    );
  }

  private rpIdHash(): Buffer {
    return sha256(this.options.rpId ?? BACKOFFICE_WEBAUTHN_RP_ID);
  }

  register(options: PublicKeyCredentialCreationOptionsJSON): RegistrationResponseJSON {
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(this.signCount);
    const credentialIdLength = Buffer.alloc(2);
    credentialIdLength.writeUInt16BE(this.credentialId.length);
    const authData = Buffer.concat([
      this.rpIdHash(),
      Buffer.from([this.flags(FLAG_ATTESTED_CREDENTIAL)]),
      counter,
      Buffer.alloc(16),
      credentialIdLength,
      this.credentialId,
      Buffer.from(this.publicKeyCose),
    ]);
    const attestationObject = isoCBOR.encode(
      new Map<string, string | Map<string, string> | Uint8Array>([
        ['fmt', 'none'],
        ['attStmt', new Map<string, string>()],
        ['authData', authData],
      ]),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64url(this.clientData('webauthn.create', options.challenge)),
        attestationObject: b64url(attestationObject),
        transports: ['internal'],
      },
      clientExtensionResults: {},
    };
  }

  authenticate(options: PublicKeyCredentialRequestOptionsJSON): AuthenticationResponseJSON {
    this.signCount += 1;
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(this.signCount);
    const authData = Buffer.concat([this.rpIdHash(), Buffer.from([this.flags()]), counter]);
    const clientDataJSON = this.clientData('webauthn.get', options.challenge);
    const signature = sign(
      'sha256',
      Buffer.concat([authData, sha256(clientDataJSON)]),
      this.privateKey,
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(signature),
      },
      clientExtensionResults: {},
    };
  }
}
