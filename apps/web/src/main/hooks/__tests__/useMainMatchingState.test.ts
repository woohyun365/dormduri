import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hookSourcePath = join(process.cwd(), 'src/main/hooks/useMainMatchingState.ts');

function readHookSource(): string {
  return readFileSync(hookSourcePath, 'utf8');
}

describe('useMainMatchingState legacy boundary', () => {
  it('dev-only fixture state machine을 runtime hook에서 직접 참조하지 않는다', () => {
    const source = readHookSource();

    expect(source).not.toContain('@/main/dev-only/fixtures');
    expect(source).not.toContain('main/dev-only/fixtures');
    expect(source).not.toContain('getMockMatchingService');
    expect(source).not.toContain('resetMockMatchingService');
    expect(source).not.toContain('mockDb');
    expect(source).not.toContain('mockRawProfiles');
  });

  it('localStorage 기반 mock state를 hook 내부 source of truth로 사용하지 않는다', () => {
    const source = readHookSource();

    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('STORAGE_KEY');
  });

  it('상태 전이는 hook 내부가 아니라 matching API boundary에 위임한다', () => {
    const source = readHookSource();

    expect(source).toContain('matchingApi.getState');
    expect(source).toContain('matchingApi.sendRequest');
    expect(source).toContain('matchingApi.acceptRequest');
    expect(source).toContain('matchingApi.endMatch');
    expect(source).not.toContain('class MockMatchingService');
  });
});
