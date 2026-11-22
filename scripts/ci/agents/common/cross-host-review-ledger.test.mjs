import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { readClaudeReviewRows } from '../../../agents/claude/review-ledger-source.mjs';
import { readCodexReviewRows } from '../../../agents/codex/review-ledger-source.mjs';
import { buildLedger } from '../../../agents/common/review-ledger.mjs';
import { codexReviewRegistry } from '../codex/fixtures/review-ledger-registry.mjs';

// The two host ledger readers hand rows of one common shape to the common ledger, which counts both hosts together.
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

test('the common summary counts Claude and Codex rows together (P6 ② RED 5)', () => {
  const root = codexReviewRegistry(temporary);
  const claudeRoot = resolve(import.meta.dirname, '../claude/fixtures/review-ledger');
  const claude = readClaudeReviewRows({
    root: claudeRoot,
    registry: resolve(claudeRoot, '.artifacts/tools/claude-native'),
    adjudicationDirectories: [resolve(claudeRoot, 'evidence')],
  });
  const codex = readCodexReviewRows({
    root,
    registry: resolve(root, '.artifacts/tools/codex-native'),
    adjudicationDirectories: [resolve(root, 'evidence')],
  });
  const ledger = buildLedger([...claude.rows, ...codex.rows]);
  assert.deepEqual(ledger.rejected, []);
  assert.deepEqual(ledger.summary.hosts, { claude: claude.rows.length, codex: 4 });
  assert.equal(ledger.summary.count, claude.rows.length + 4);
  // The Codex subject: round 1 FAIL then round 2 PASS on another snapshot, sized by its round 1 criteria record.
  assert.deepEqual(
    ledger.summary.subjectRows.find(({ subjectKey }) => subjectKey === 'codex-feature'),
    {
      subjectKey: 'codex-feature',
      paths: 2,
      documents: 1,
      runs: 2,
      rounds: 2,
      origins: {},
      trailingNonPass: 0,
      snapshots: 2,
    },
  );
});
