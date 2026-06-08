import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const workspaceRoot = join(process.cwd(), '../..');
const sharedSourceRoot = join(workspaceRoot, 'packages/shared/src');
const webSourceRoot = join(workspaceRoot, 'apps/web/src');

const canonicalReportReasons = [
  'SEXUAL_HARASSMENT',
  'THREAT',
  'PERSONAL_INFO_EXPOSURE',
  'GENDER_IMPERSONATION',
  'FALSE_PROFILE',
  'SPAM_OR_AD',
  'HATE_OR_DISCRIMINATION',
  'OTHER',
] as const;

const legacyWebOnlyReportReasons = ['SPAM', 'FAKE_INFO', 'OFFENSIVE', 'SCAM'] as const;
const legacyWebReportReasonMembers = [...legacyWebOnlyReportReasons, 'OTHER'] as const;

function readOptional(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('Phase 1 expected-red social-safety shared contract', () => {
  it('defines the official 8 report reasons and no longer accepts legacy Web-only reasons', () => {
    const reportContractPath = join(sharedSourceRoot, 'social-safety/report.ts');
    const source = readOptional(reportContractPath);

    expect({
      exists: existsSync(reportContractPath),
      missingReasons: canonicalReportReasons.filter((reason) => !source.includes(reason)),
      legacyReasonsStillPresent: legacyWebOnlyReportReasons.filter((reason) =>
        source.includes(reason),
      ),
    }).toEqual({
      exists: true,
      missingReasons: [],
      legacyReasonsStillPresent: [],
    });
  });

  it('keeps the stale Web 5-reason type from remaining canonical', () => {
    const legacyWebSource = readOptional(join(webSourceRoot, 'types/report.ts'));

    expect(legacyWebReportReasonMembers.every((reason) => legacyWebSource.includes(reason))).toBe(
      false,
    );
    expect(legacyWebOnlyReportReasons.filter((reason) => legacyWebSource.includes(reason))).toEqual(
      [],
    );
    expect(legacyWebSource).toContain('SEXUAL_HARASSMENT');
    expect(legacyWebSource).toContain('HATE_OR_DISCRIMINATION');
  });

  it('defines bookmark request/query/response contracts with privacy-safe list metadata', () => {
    const bookmarkContractPath = join(sharedSourceRoot, 'social-safety/bookmark.ts');
    const source = readOptional(bookmarkContractPath);
    const requiredSymbols = [
      'CreateBookmarkRequest',
      'DeleteBookmarkRequest',
      'ListBookmarksQuery',
      'BookmarkListResponse',
      'BookmarkSort',
      'BookmarkEmptyStateCode',
      'NO_BOOKMARKS',
      'NO_VISIBLE_BOOKMARKS',
    ];
    const forbiddenSymbols = [
      'hiddenReasonCode',
      'hiddenReasonDetail',
      'deletedAt',
      'retainedVaultPayload',
      'rawLifecycleTimestamp',
    ];

    expect({
      exists: existsSync(bookmarkContractPath),
      missingSymbols: requiredSymbols.filter((symbol) => !source.includes(symbol)),
      forbiddenSymbolsPresent: forbiddenSymbols.filter((symbol) => source.includes(symbol)),
    }).toEqual({
      exists: true,
      missingSymbols: [],
      forbiddenSymbolsPresent: [],
    });
  });

  it('adds report/support notification kinds without permitting raw sensitive notification payload fields', () => {
    const notificationContractPath = join(sharedSourceRoot, 'notifications/contract.ts');
    const source = readOptional(notificationContractPath);
    const requiredNotificationSymbols = [
      'REPORT_RECEIVED',
      'REPORT_STATUS_UPDATED',
      'SUPPORT_TICKET_CREATED',
      'SUPPORT_TICKET_REPLIED',
      'SUPPORT_TICKET_ACTION_REQUIRED',
      'SUPPORT_APPEAL_RESOLVED',
    ];
    const forbiddenPayloadSymbols = [
      'reportDetail',
      'supportBody',
      'blockNote',
      'email',
      'retainedVaultPayload',
    ];

    expect({
      missingSymbols: requiredNotificationSymbols.filter((symbol) => !source.includes(symbol)),
      forbiddenSymbolsPresent: forbiddenPayloadSymbols.filter((symbol) => source.includes(symbol)),
    }).toEqual({
      missingSymbols: [],
      forbiddenSymbolsPresent: [],
    });
  });
});
