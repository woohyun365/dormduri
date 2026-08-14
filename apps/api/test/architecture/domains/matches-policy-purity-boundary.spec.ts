import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  apiRelative,
  filesContaining,
  matchesRoot,
  productionTypeScriptFiles,
  readSource,
} from './matches-boundary.support.js';

describe('Matches policy purity boundary', () => {
  it('request와 active-match policy는 Nest·Prisma infrastructure에서 독립적이다', () => {
    const forbidden =
      /from\s+['"].*(?:@nestjs|generated\/prisma|platform\/database)|\bPrismaService\b|\bInjectable\b/;

    for (const policyRoot of [
      join(matchesRoot, 'requests/policies'),
      join(matchesRoot, 'active/policies'),
    ]) {
      expect(filesContaining(policyRoot, forbidden)).toEqual([]);
    }
  });

  it('match history materialization은 chat-derived state를 사용하지 않는다', () => {
    const offenders = productionTypeScriptFiles(join(matchesRoot, 'history/materialization'))
      .filter((path) =>
        /\bConversationThread\b|\bConversationMessage\b|conversationThreads|lastMessageAt|hadConversation|threadClosedReason/.test(
          readSource(path),
        ),
      )
      .map(apiRelative)
      .sort();

    expect(offenders).toEqual([]);
  });
});
