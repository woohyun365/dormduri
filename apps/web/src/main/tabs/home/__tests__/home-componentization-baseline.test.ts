import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const homeRoot = join(process.cwd(), 'src/main/tabs/home');

function readHomeSource(relativePath: string): string {
  return readFileSync(join(homeRoot, relativePath), 'utf8');
}

describe('Home composition boundary', () => {
  it('keeps HomeTab focused on composition instead of presentation or direct I/O', () => {
    const source = readHomeSource('HomeTab.tsx');

    expect(source).toContain('./layout/HomeHeader');
    expect(source).toContain('./layout/HomeNonOperatedOverlay');
    expect(source).toContain('./api/home-active-match.api');
    expect(source).not.toMatch(/\bfetch\s*\(|\/api\/matches\/active\//u);
    expect(source).not.toContain('getAvatarColor');
    expect(source).not.toContain('motion.button');
  });

  it('keeps reusable scroll, focus, and z-index behavior in responsive overlay primitives', () => {
    const sheetOwners = [
      'sections/primary/PrimaryWithdrawalSheet.tsx',
      'sections/activity/dialogs/OperatedDormitoryListModal.tsx',
      'sections/activity/dialogs/SeasonOpenActionModal.tsx',
      'sections/activity/dialogs/PostMatchDetailModal.tsx',
      'sections/activity/dialogs/PostMatchCounterpartProfileModal.tsx',
      'sections/activity/dialogs/OffSeasonDetailModal.tsx',
    ];

    for (const owner of sheetOwners) {
      const source = readHomeSource(owner);
      expect(source).toMatch(/overlays\/HomeResponsiveSheet/u);
      expect(source).not.toContain('useBodyScrollLock');
      expect(source).not.toContain('useFocusTrap');
      expect(source).not.toContain('Z_INDEX');
    }
  });

  it('keeps matching mutation dialogs on the shared overlay and outside direct network I/O', () => {
    const dialogSource = readHomeSource('sections/matching/UnmatchActionDialog.tsx');
    const activeMatchSource = readHomeSource('sections/matching/ActiveMatchSummaryCard.tsx');

    expect(dialogSource).toContain('../../overlays/HomeResponsiveDialog');
    expect(dialogSource).not.toMatch(/\bfetch\s*\(/u);
    expect(activeMatchSource).not.toMatch(/\bfetch\s*\(/u);
  });

  it('derives dashboard readiness from the server-owned season profile model', () => {
    const source = readHomeSource('model/homeDashboardViewModel.ts');

    expect(source).toContain('seasonProfile');
    expect(source).not.toContain('UserProfile');
    expect(source).not.toContain('user.lifestyle');
    expect(source).not.toContain('isLifestyleRequiredComplete');
  });
});
