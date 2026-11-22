import type { BrowserContext, Page } from '@playwright/test';

/**
 * Chromium virtual authenticator (DevTools WebAuthn domain). `internal` stands for a platform
 * passkey, `usb` for a security key (plan §14: both kinds are tried before the Owner's real device).
 * It answers every ceremony with user verification and presence, so the flow runs unattended.
 */
export async function addVirtualAuthenticator(
  context: BrowserContext,
  page: Page,
  transport: 'internal' | 'usb',
): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}
