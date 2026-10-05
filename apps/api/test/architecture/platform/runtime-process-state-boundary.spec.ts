import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const apiRoot = process.cwd();
const workspaceRoot = join(apiRoot, '../..');
const runtimeDocumentPath = join(
  workspaceRoot,
  'docs/architecture/backend/runtime-composition-and-process-state.md',
);

function readApi(path: string) {
  return readFileSync(join(apiRoot, path), 'utf8');
}

// A focused guard for the retired serving-off/worker-on recommendation, not a
// natural-language policy validator or a ban on discussing future workers.
function unsupportedWorkerRecommendations(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/`/g, '').replace(/\s+/g, ' '))
    .filter((paragraph) =>
      /LIFECYCLE_SWEEP_ENABLED\s*=\s*false\b.*(?:별도\s*worker|worker\s*deployment).*\btrue\b.*(?:우선한다|권장한다)/i.test(
        paragraph,
      ),
    );
}

describe('combined runtime documentation boundary', () => {
  it.each([
    '초기 운영은 API serving instance는 `LIFECYCLE_SWEEP_ENABLED=false`, 별도 worker deployment 1개만 `true`로 두는 구성을 우선한다.',
    'API serving은 LIFECYCLE_SWEEP_ENABLED = false,\n별도 worker는 true로 두는 구성을 권장한다.',
  ])('rejects the unsupported worker-only recipe: %s', (recommendation) => {
    expect(unsupportedWorkerRecommendations(recommendation)).toHaveLength(1);
  });

  it.each([
    '현재 combined API가 enabled lifecycle sweep을 실행하며 별도 worker binary는 없다.',
    'LIFECYCLE_SWEEP_ENABLED=false, 별도 worker=true 구성을 권장하지 않는다.',
    '미래 worker capability는 named workload와 좁은 module graph를 검증한 뒤 별도 결정한다.',
    'RetentionWorkerPrismaService는 DB credential boundary이며 worker runtime이 아니다.',
  ])('allows current limitations and future worker discussion: %s', (description) => {
    expect(unsupportedWorkerRecommendations(description)).toEqual([]);
  });

  it('does not recommend a nonexistent serving-off/worker-on deployment in the owner README', () => {
    expect(unsupportedWorkerRecommendations(readApi('src/lifecycle/README.md'))).toEqual([]);
  });

  it('grounds the combined role in the current executable and deployment composition', () => {
    const main = readApi('src/main.ts');
    const appModule = readApi('src/app.module.ts');
    const compose = readFileSync(join(workspaceRoot, 'infra/deploy/compose.api.yml'), 'utf8');

    expect(main.match(/NestFactory\.create\s*\(/g)).toHaveLength(1);
    expect(main).toMatch(/NestFactory\.create\(AppModule\b/);
    expect(main).toMatch(/useWebSocketAdapter\(new ChatRealtimeIoAdapter\(app, chatSettings\)\)/);
    expect(main).not.toContain('createApplicationContext');
    expect(appModule).toMatch(/ScheduleModule\.forRoot\(\)/);
    for (const owner of ['AuthModule', 'ChatModule', 'LifecycleModule']) {
      expect(appModule).toMatch(new RegExp(`^\\s+${owner},$`, 'm'));
    }
    expect(compose).toMatch(/^ {2}api:$/m);
    expect(compose).not.toMatch(/^ {2}[\w-]*worker[\w-]*:$/m);
  });

  it('retains six explicit semantic fields for each reviewed process-local state owner', () => {
    const documentation = readFileSync(runtimeDocumentPath, 'utf8');
    const inventory = documentation.split('## Process-local state inventory')[1]?.split('\n## ')[0];
    const rows = inventory
      ?.split('\n')
      .filter((line) => line.startsWith('|'))
      .map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );

    expect(rows?.[0]).toEqual([
      'Owner / source',
      'Semantic',
      'Correctness scope',
      'Failure/reset implication',
      'Scale trigger',
      'Multi-instance limitation',
    ]);
    for (const owner of [
      'ChatRealtimeTicketService',
      'ChatRealtimeRateLimiterService.buckets',
      'userSocketCounts / gateway registration',
      'ChatRealtimeIoAdapter pre-auth closure',
      'ChatRealtimePublisher',
      'AuthMailDispatcherService',
      'ChatRealtimeDispatcherService',
      'NotificationOutboxDispatcherService',
      'LifecycleSweepService',
      'ProcessPasswordHashAdmission',
    ]) {
      const matchingRows = rows?.filter((row) => row[0]?.startsWith(`[${owner}]`));
      expect(matchingRows, owner).toHaveLength(1);
      expect(matchingRows?.[0], owner).toHaveLength(6);
      expect(
        matchingRows?.[0]?.every((cell) => cell.length > 0),
        owner,
      ).toBe(true);
    }
    expect(unsupportedWorkerRecommendations(documentation)).toEqual([]);
  });

  it('keeps architecture evidence links and lifecycle verification paths resolvable', () => {
    const documentation = readFileSync(runtimeDocumentPath, 'utf8');
    for (const [, target] of documentation.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      if (!target) throw new Error('Expected a runtime evidence link target');
      expect(existsSync(resolve(dirname(runtimeDocumentPath), target)), target).toBe(true);
    }

    const readme = readApi('src/lifecycle/README.md');
    expect(readme).not.toContain('src/architecture/');
    const guards = [...readme.matchAll(/test\/architecture\/[\w/.-]+\.spec\.ts/g)];
    expect(guards.length).toBeGreaterThan(0);
    for (const [path] of guards) {
      expect(existsSync(join(apiRoot, path)), path).toBe(true);
    }
  });
});
