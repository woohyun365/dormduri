import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  apiRelative,
  externalProductionFiles,
  matchesRoot,
  productionTypeScriptFiles,
  readSource,
} from './matches-boundary.support.js';

const allowedInternalConsumers = [
  'src/matches/active/commands/cancel-unmatch-request.command.ts',
  'src/matches/active/commands/request-unmatch.command.ts',
  'src/matches/active/lifecycle/active-match-lifecycle-sweep.service.ts',
  'src/matches/active/lifecycle-events/active-match-lifecycle-event.repository.ts',
  'src/matches/active/lifecycle-events/active-match-lifecycle-event.writer.ts',
  'src/matches/composition/matches.providers.ts',
  'src/matches/requests/commands/accept-match-request.command.ts',
  'src/matches/test-support/matches-service-spec.harness.ts',
] as const;

describe('Matches lifecycle ownership boundary', () => {
  it('ActiveMatch lifecycle append internals는 matches owner 밖으로 노출하지 않는다', () => {
    const pattern =
      /from\s+['"][^'"]*matches\/active\/lifecycle-events\/[^'"]*['"]|\bActiveMatchLifecycleEvent(?:Writer|Repository)\b/;
    const internalConsumers = productionTypeScriptFiles(matchesRoot)
      .filter((path) => pattern.test(readSource(path)))
      .map(apiRelative)
      .sort();
    const externalConsumers = externalProductionFiles()
      .filter((path) => pattern.test(readSource(path)))
      .map(apiRelative)
      .sort();
    const exportsSource = readSource(join(matchesRoot, 'composition/matches.exports.ts'));

    expect(externalConsumers).toEqual([]);
    expect(internalConsumers).toEqual([...allowedInternalConsumers].sort());
    expect(exportsSource).not.toMatch(
      /ActiveMatchLifecycleEvent(?:Writer|Repository)|active\/lifecycle-events/,
    );
  });
});
