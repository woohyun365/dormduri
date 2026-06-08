import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const workspaceRoot = join(process.cwd(), '../..');
const sharedSourceRoot = join(workspaceRoot, 'packages/shared/src');

function readOptional(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('Phase 1 expected-red support shared contract', () => {
  it('defines support ticket/FAQ/appeal contracts before support API implementation', () => {
    const supportContractPath = join(sharedSourceRoot, 'support/contract.ts');
    const source = readOptional(supportContractPath);
    const requiredSymbols = [
      'SupportTicketCategory',
      'CreateSupportTicketRequest',
      'SupportTicketResponse',
      'SupportTicketStatus',
      'SupportFaqItem',
      'SupportAppealCategory',
      'emailReplyConsent',
    ];
    const forbiddenSymbols = ['supportBodyInNotification', 'rawAppealDetailInNotification'];

    expect({
      exists: existsSync(supportContractPath),
      missingSymbols: requiredSymbols.filter((symbol) => !source.includes(symbol)),
      forbiddenSymbolsPresent: forbiddenSymbols.filter((symbol) => source.includes(symbol)),
    }).toEqual({
      exists: true,
      missingSymbols: [],
      forbiddenSymbolsPresent: [],
    });
  });
});
