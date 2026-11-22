import type { BrowserContext, CDPSession, Page } from '@playwright/test';

export interface VirtualAuthenticator {
  readonly cdp: CDPSession;
  readonly authenticatorId: string;
}

/**
 * Chromium virtual authenticator (DevTools WebAuthn domain). `internal` stands for a platform
 * passkey, `usb` for a security key; both kinds run before the Owner's real device does. It answers
 * every ceremony with user verification and presence, so the flow runs unattended.
 */
export async function addVirtualAuthenticator(
  context: BrowserContext,
  page: Page,
  transport: 'internal' | 'usb',
): Promise<VirtualAuthenticator> {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}

/**
 * A new, empty authenticator in place of the old one: the operator adds a passkey on another
 * device (the old device holds a credential the registration excludes).
 */
export async function replaceVirtualAuthenticator(
  current: VirtualAuthenticator,
  transport: 'internal' | 'usb',
): Promise<VirtualAuthenticator> {
  await current.cdp.send('WebAuthn.removeVirtualAuthenticator', {
    authenticatorId: current.authenticatorId,
  });
  const { authenticatorId } = await current.cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp: current.cdp, authenticatorId };
}
