import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const sourceRoot = join(apiRoot, 'src');

const allowedCoverageClasses = [
  'transaction-atomicity',
  'concurrency-race',
  'stale-state-recheck',
  'side-effect-rollback',
  'retention-archive',
  'wrapper-contract',
  'transaction-infrastructure',
] as const;

type CoverageClass = (typeof allowedCoverageClasses)[number];

interface AcidCoverageEntry {
  path: string;
  owner: string;
  coverageClass: CoverageClass;
  coverageRefs: readonly string[];
  rationale: string;
}

const acidCoverageInventory: readonly AcidCoverageEntry[] = [
  entry({
    path: 'src/auth/credentials/change-password.command.ts',
    owner: 'auth/credentials',
    coverageClass: 'stale-state-recheck',
    coverageRefs: [
      'src/auth/credentials/change-password.command.spec.ts',
      'test/integration/auth/auth.service.integration.spec.ts',
    ],
    rationale: '비밀번호 변경은 현재 credential 상태를 transaction 내부에서 재확인해야 한다.',
  }),
  entry({
    path: 'src/auth/credentials/reset-password.command.ts',
    owner: 'auth/credentials',
    coverageClass: 'transaction-atomicity',
    coverageRefs: [
      'src/auth/credentials/reset-password.command.spec.ts',
      'test/integration/auth/auth.service.integration.spec.ts',
    ],
    rationale: 'reset token consume과 credential update가 부분 적용 없이 함께 완료되어야 한다.',
  }),
  entry({
    path: 'src/auth/registration/signup.command.ts',
    owner: 'auth/registration',
    coverageClass: 'transaction-atomicity',
    coverageRefs: [
      'src/auth/registration/signup.command.spec.ts',
      'test/integration/auth/auth.service.integration.spec.ts',
    ],
    rationale: 'signup user/profile 초기 row는 동일 transaction에서 생성되어야 한다.',
  }),
  entry({
    path: 'src/auth/sessions/auth-session.repository.ts',
    owner: 'auth/sessions',
    coverageClass: 'wrapper-contract',
    coverageRefs: [
      'src/auth/sessions/auth-session.service.spec.ts',
      'test/integration/auth/auth.service.integration.spec.ts',
    ],
    rationale:
      'session repository는 Prisma transaction wrapper를 session command에 전달하는 경계다.',
  }),
  entry({
    path: 'src/auth/sessions/renew-session.command.ts',
    owner: 'auth/sessions',
    coverageClass: 'concurrency-race',
    coverageRefs: [
      'src/auth/sessions/auth-session.service.spec.ts',
      'test/integration/auth/auth.service.integration.spec.ts',
    ],
    rationale:
      'session renewal rotation/reuse detection은 동시 renewal이 deterministic하게 닫혀야 한다.',
  }),
  entry({
    path: 'src/auth/verification/verification-code.repository.ts',
    owner: 'auth/verification',
    coverageClass: 'concurrency-race',
    coverageRefs: [
      'src/auth/verification/verification-code.repository.spec.ts',
      'test/integration/auth/auth-verification.store.integration.spec.ts',
    ],
    rationale:
      'verification consume/attempt/expiry는 동시 consume과 attempt race를 repository transaction에서 닫는다.',
  }),
  entry({
    path: 'src/chat/application/chat.service.ts',
    owner: 'chat/application',
    coverageClass: 'wrapper-contract',
    coverageRefs: [
      'src/chat/application/chat.service.spec.ts',
      'test/integration/chat/chat.integration.spec.ts',
    ],
    rationale: 'ChatService는 command dependency에 transaction wrapper를 주입하는 facade 경계다.',
  }),
  entry({
    path: 'src/chat/commands/chat-command.types.ts',
    owner: 'chat/commands',
    coverageClass: 'wrapper-contract',
    coverageRefs: [
      'src/chat/commands/send-message.command.spec.ts',
      'src/chat/application/chat.service.spec.ts',
    ],
    rationale: 'command dependency contract가 transaction callback shape를 고정한다.',
  }),
  entry({
    path: 'src/chat/commands/leave-thread.command.ts',
    owner: 'chat/commands',
    coverageClass: 'stale-state-recheck',
    coverageRefs: [
      'src/chat/commands/leave-thread.command.spec.ts',
      'test/integration/chat/chat.integration.spec.ts',
    ],
    rationale: 'thread leave는 권한과 thread 상태를 mutation 직전에 다시 확인해야 한다.',
  }),
  entry({
    path: 'src/chat/commands/send-message.command.ts',
    owner: 'chat/commands',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/chat/commands/send-message.command.spec.ts',
      'test/integration/chat/chat.integration.spec.ts',
    ],
    rationale:
      'message insert와 realtime/outbox side effect가 ghost row 없이 함께 처리되어야 한다.',
  }),
  entry({
    path: 'src/chat/commands/update-read-marker.command.ts',
    owner: 'chat/commands',
    coverageClass: 'stale-state-recheck',
    coverageRefs: [
      'src/chat/commands/update-read-marker.command.spec.ts',
      'test/integration/chat/chat.integration.spec.ts',
    ],
    rationale:
      'read marker update는 thread membership과 message visibility를 transaction 경계에서 확인한다.',
  }),
  entry({
    path: 'src/chat/lifecycle/chat-season-lifecycle.service.ts',
    owner: 'chat/lifecycle',
    coverageClass: 'concurrency-race',
    coverageRefs: [
      'src/chat/lifecycle/chat-season-lifecycle.service.spec.ts',
      'test/integration/seasons/season-transition.integration.spec.ts',
    ],
    rationale: 'season close/open lifecycle은 thread state transition을 중복 없이 적용해야 한다.',
  }),
  entry({
    path: 'src/chat/retention/thread-retention-archive.handler.ts',
    owner: 'chat/retention',
    coverageClass: 'retention-archive',
    coverageRefs: [
      'src/chat/README.md',
      'test/integration/retention/retention.integration.spec.ts',
    ],
    rationale:
      'thread retention archive는 retained vault write와 source redaction을 같은 archive transaction에 묶는다.',
  }),
  entry({
    path: 'src/matches/active/commands/cancel-unmatch-request.command.ts',
    owner: 'matches/active',
    coverageClass: 'concurrency-race',
    coverageRefs: [
      'src/matches/active/commands/unmatch-command-flow.spec.ts',
      'test/integration/matches/unmatch.integration.spec.ts',
    ],
    rationale:
      'unmatch cancel은 pending request 상태를 transaction 안에서 deterministic하게 해소한다.',
  }),
  entry({
    path: 'src/matches/active/commands/request-unmatch.command.ts',
    owner: 'matches/active',
    coverageClass: 'concurrency-race',
    coverageRefs: [
      'src/matches/active/commands/unmatch-command-flow.spec.ts',
      'test/integration/matches/unmatch.integration.spec.ts',
    ],
    rationale: 'unmatch request는 중복 요청과 active match 상태 race를 닫아야 한다.',
  }),
  entry({
    path: 'src/matches/active/lifecycle/active-match-lifecycle-sweep.service.ts',
    owner: 'matches/active-lifecycle',
    coverageClass: 'retention-archive',
    coverageRefs: [
      'src/matches/active/lifecycle/active-match-lifecycle-sweep.service.spec.ts',
      'test/integration/matches/unmatch.integration.spec.ts',
    ],
    rationale:
      'active match lifecycle sweep는 terminal transition과 history side effect를 중복 없이 적용한다.',
  }),
  entry({
    path: 'src/matches/history/application/match-history-materialization.service.ts',
    owner: 'matches/history',
    coverageClass: 'transaction-atomicity',
    coverageRefs: [
      'src/matches/history/application/match-history-materialization.service.spec.ts',
      'test/integration/matches/match-history.integration.spec.ts',
    ],
    rationale:
      'match history rebuild/materialization은 source read와 snapshot write가 같은 transaction에 묶여야 한다.',
  }),
  entry({
    path: 'src/matches/history/retention/match-history-archive.handler.ts',
    owner: 'matches/history-retention',
    coverageClass: 'retention-archive',
    coverageRefs: [
      'src/matches/history/application/match-history-materialization.service.spec.ts',
      'test/integration/retention/retention.integration.spec.ts',
    ],
    rationale:
      'match history retention archive는 retained vault write와 redaction을 atomic하게 보존한다.',
  }),
  entry({
    path: 'src/matches/requests/commands/accept-match-request.command.ts',
    owner: 'matches/requests',
    coverageClass: 'concurrency-race',
    coverageRefs: [
      'src/matches/requests/commands/match-request-command-flow.spec.ts',
      'test/integration/matches/matches.integration.spec.ts',
    ],
    rationale:
      'request accept는 competing accept/terminal transition race를 transaction 안에서 닫는다.',
  }),
  entry({
    path: 'src/matches/requests/commands/create-match-request.command.ts',
    owner: 'matches/requests',
    coverageClass: 'stale-state-recheck',
    coverageRefs: [
      'src/matches/requests/commands/match-request-command-flow.spec.ts',
      'test/integration/matches/matches.integration.spec.ts',
    ],
    rationale:
      'request create는 participant visibility/eligibility를 mutation 직전에 다시 확인한다.',
  }),
  entry({
    path: 'src/matches/requests/commands/resolve-terminal-match-request.command.ts',
    owner: 'matches/requests',
    coverageClass: 'concurrency-race',
    coverageRefs: [
      'src/matches/requests/commands/match-request-command-flow.spec.ts',
      'test/integration/matches/matches.integration.spec.ts',
    ],
    rationale: 'terminal request resolution은 duplicate terminal writes와 status race를 닫는다.',
  }),
  entry({
    path: 'src/notifications/campaigns/notification-campaign-fanout.service.ts',
    owner: 'notifications/campaigns',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/notifications/campaigns/notification-campaign-bounds.spec.ts',
      'test/integration/notifications/notifications.integration.spec.ts',
    ],
    rationale:
      'campaign fanout은 notification/outbox materialization이 bounded batch 단위로 원자 처리되어야 한다.',
  }),
  entry({
    path: 'src/notifications/commands/materialize-profile-mismatch-feedback.command.ts',
    owner: 'notifications/commands',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/notifications/commands/create-notification.command.spec.ts',
      'test/integration/notifications/notifications.integration.spec.ts',
    ],
    rationale:
      'profile mismatch feedback notification은 report candidate consumption과 notification write를 함께 처리한다.',
  }),
  entry({
    path: 'src/platform/database/prisma.service.ts',
    owner: 'platform/database',
    coverageClass: 'transaction-infrastructure',
    coverageRefs: [
      'src/platform/database/prisma.service.spec.ts',
      'test/integration/platform/time-boundary.integration.spec.ts',
    ],
    rationale:
      'PrismaService가 Serializable isolation과 retryable conflict contract의 source of truth다.',
  }),
  entry({
    path: 'src/retention/retained-identities/retained-identity.service.ts',
    owner: 'retention/retained-identities',
    coverageClass: 'wrapper-contract',
    coverageRefs: [
      'src/retention/retained-identities/retained-identity-disposal.service.spec.ts',
      'test/integration/users/account-deletion.integration.spec.ts',
    ],
    rationale:
      'retained identity owner는 snapshot creation transaction을 account deletion flow에 제공한다.',
  }),
  entry({
    path: 'src/retention/review-jobs/retention-review-job-runner.service.ts',
    owner: 'retention/review-jobs',
    coverageClass: 'retention-archive',
    coverageRefs: [
      'src/retention/review-jobs/retention-review-job-runner.service.spec.ts',
      'test/integration/retention/retention.integration.spec.ts',
    ],
    rationale:
      'retention review job은 claimed work item별 retained body review를 transaction 단위로 처리한다.',
  }),
  entry({
    path: 'src/season-participants/deregistration/deregister-season-participant.command.ts',
    owner: 'season-participants/deregistration',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/season-participants/deregistration/deregister-season-participant.command.spec.ts',
      'test/integration/season-participants/season-registration.integration.spec.ts',
    ],
    rationale:
      'deregistration은 participant close와 match/chat side effects를 ghost row 없이 처리해야 한다.',
  }),
  entry({
    path: 'src/season-participants/dormitory-selection/update-dormitory-selection.command.ts',
    owner: 'season-participants/dormitory-selection',
    coverageClass: 'stale-state-recheck',
    coverageRefs: [
      'src/season-participants/dormitory-selection/dormitory-selection.use-case.spec.ts',
      'test/integration/season-participants/season-registration.integration.spec.ts',
    ],
    rationale:
      'dormitory selection update는 current participant 상태를 transaction 내부에서 fail-closed로 확인한다.',
  }),
  entry({
    path: 'src/season-participants/lifecycle/backfill-current-season-participants.command.ts',
    owner: 'season-participants/lifecycle',
    coverageClass: 'concurrency-race',
    coverageRefs: [
      'src/season-participants/lifecycle/backfill-current-season-participants.command.spec.ts',
      'test/integration/season-participants/season-registration.integration.spec.ts',
    ],
    rationale:
      'current season participant backfill은 중복 container 생성 없이 current participation을 복구한다.',
  }),
  entry({
    path: 'src/season-participants/profile-draft/upsert-season-profile-draft.command.ts',
    owner: 'season-participants/profile-draft',
    coverageClass: 'stale-state-recheck',
    coverageRefs: [
      'src/season-participants/profile-draft/upsert-season-profile-draft.command.spec.ts',
      'test/integration/season-participants/season-registration.integration.spec.ts',
    ],
    rationale:
      'profile draft upsert는 participant eligibility와 draft completeness를 mutation 직전에 확인한다.',
  }),
  entry({
    path: 'src/season-participants/registration/finalize-season-registration.command.ts',
    owner: 'season-participants/registration',
    coverageClass: 'concurrency-race',
    coverageRefs: [
      'src/season-participants/registration/finalize-season-registration.command.spec.ts',
      'test/integration/season-participants/season-registration.integration.spec.ts',
    ],
    rationale:
      'registration finalize는 동일 user/season 중복 등록과 readiness race를 Serializable transaction으로 닫는다.',
  }),
  entry({
    path: 'src/season-participants/retention/season-profile-history-archive.handler.ts',
    owner: 'season-participants/retention',
    coverageClass: 'retention-archive',
    coverageRefs: [
      'src/season-participants/README.md',
      'test/integration/retention/retention.integration.spec.ts',
    ],
    rationale:
      'season profile history archive는 source history redaction과 retained vault payload를 atomic하게 묶는다.',
  }),
  entry({
    path: 'src/social-safety/blocks/commands/create-block.command.ts',
    owner: 'social-safety/blocks',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/social-safety/blocks/commands/create-block.command.spec.ts',
      'test/integration/social-safety/social-safety-block.integration.spec.ts',
    ],
    rationale:
      'block create는 block row와 chat/match side effects를 partial write 없이 처리해야 한다.',
  }),
  entry({
    path: 'src/social-safety/blocks/commands/delete-block.command.ts',
    owner: 'social-safety/blocks',
    coverageClass: 'transaction-atomicity',
    coverageRefs: [
      'src/social-safety/blocks/commands/create-block.command.spec.ts',
      'test/integration/social-safety/social-safety-block.integration.spec.ts',
    ],
    rationale: 'block delete는 active block 상태와 event append를 동일 transaction에서 해소한다.',
  }),
  entry({
    path: 'src/social-safety/bookmarks/commands/create-bookmark.command.ts',
    owner: 'social-safety/bookmarks',
    coverageClass: 'stale-state-recheck',
    coverageRefs: [
      'src/social-safety/bookmarks/commands/create-bookmark.command.spec.ts',
      'test/integration/social-safety/social-safety-bookmark.integration.spec.ts',
    ],
    rationale:
      'bookmark create는 target visibility/season eligibility를 mutation 직전에 fail-closed로 확인한다.',
  }),
  entry({
    path: 'src/social-safety/bookmarks/commands/delete-bookmark.command.ts',
    owner: 'social-safety/bookmarks',
    coverageClass: 'transaction-atomicity',
    coverageRefs: [
      'src/social-safety/bookmarks/commands/delete-bookmark.command.spec.ts',
      'test/integration/social-safety/social-safety-bookmark.integration.spec.ts',
    ],
    rationale:
      'bookmark delete는 active bookmark 상태와 deletedAt transition을 atomic하게 처리한다.',
  }),
  entry({
    path: 'src/social-safety/reports/commands/create-report.command.ts',
    owner: 'social-safety/reports',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/social-safety/reports/resolvers/report-target-context.resolver.spec.ts',
      'test/integration/social-safety/social-safety-report.integration.spec.ts',
    ],
    rationale:
      'report intake는 case/event/notification/retention reference write를 ghost row 없이 처리해야 한다.',
  }),
  entry({
    path: 'src/support/commands/append-support-ticket-message.command.ts',
    owner: 'support/commands',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/support/commands/append-support-ticket-message.command.spec.ts',
      'test/integration/support/support.integration.spec.ts',
    ],
    rationale:
      'support message append는 ticket status validation과 notification side effect를 함께 처리한다.',
  }),
  entry({
    path: 'src/support/commands/create-support-ticket.command.ts',
    owner: 'support/commands',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/support/commands/create-support-ticket.command.spec.ts',
      'test/integration/support/support.integration.spec.ts',
    ],
    rationale:
      'support ticket creation은 ticket/message/notification 초기 row를 partial write 없이 생성한다.',
  }),
  entry({
    path: 'src/support/commands/reply-support-ticket.command.ts',
    owner: 'support/commands',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/support/commands/reply-support-ticket.command.spec.ts',
      'test/integration/support/support.integration.spec.ts',
    ],
    rationale:
      'operator reply는 ticket transition과 notification write를 동일 transaction에서 처리한다.',
  }),
  entry({
    path: 'src/support/commands/resolve-support-ticket.command.ts',
    owner: 'support/commands',
    coverageClass: 'transaction-atomicity',
    coverageRefs: [
      'src/support/commands/resolve-support-ticket.command.spec.ts',
      'test/integration/support/support.integration.spec.ts',
    ],
    rationale: 'support resolve는 terminal status와 resolution metadata를 atomic하게 반영한다.',
  }),
  entry({
    path: 'src/users/account-deletion/request-account-deletion.command.ts',
    owner: 'users/account-deletion',
    coverageClass: 'side-effect-rollback',
    coverageRefs: [
      'src/users/account-deletion/request-account-deletion.command.spec.ts',
      'test/integration/users/account-deletion.integration.spec.ts',
    ],
    rationale:
      'account deletion은 retained identity snapshot과 user state transition을 ghost 없이 처리한다.',
  }),
  entry({
    path: 'src/users/application/user-update-owner.ts',
    owner: 'users/application',
    coverageClass: 'wrapper-contract',
    coverageRefs: [
      'src/users/application/user-update-owner.spec.ts',
      'test/integration/users/users.integration.spec.ts',
    ],
    rationale:
      'user update owner는 display/academic identity command에 transaction owner contract를 제공한다.',
  }),
  entry({
    path: 'src/users/identity/retention/academic-identity-audit-archive.handler.ts',
    owner: 'users/identity-retention',
    coverageClass: 'retention-archive',
    coverageRefs: [
      'src/users/README.md',
      'test/integration/retention/retention.integration.spec.ts',
    ],
    rationale:
      'academic identity audit archive는 audit rows redaction과 retained vault write를 atomic하게 묶는다.',
  }),
  entry({
    path: 'src/users/identity/retention/nickname-audit-archive.handler.ts',
    owner: 'users/identity-retention',
    coverageClass: 'retention-archive',
    coverageRefs: [
      'src/users/README.md',
      'test/integration/retention/retention.integration.spec.ts',
    ],
    rationale:
      'nickname audit archive는 audit rows redaction과 retained vault write를 atomic하게 묶는다.',
  }),
  entry({
    path: 'src/users/operations/override-display-identity-nickname.command.ts',
    owner: 'users/operations',
    coverageClass: 'transaction-atomicity',
    coverageRefs: [
      'src/users/operations/override-display-identity-nickname.command.spec.ts',
      'test/integration/users/users.integration.spec.ts',
    ],
    rationale:
      'operator nickname override는 display identity update와 audit row append를 atomic하게 처리한다.',
  }),
];

function entry(input: AcidCoverageEntry): AcidCoverageEntry {
  return input;
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function sorted(values: readonly string[]) {
  return [...values].sort();
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      return walkFiles(path);
    }

    return entry.isFile() ? [path] : [];
  });
}

function relativeApiPath(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

function isProductionSourceFile(path: string) {
  const relativePath = relativeApiPath(path);

  return (
    path.endsWith('.ts') &&
    !path.endsWith('.spec.ts') &&
    !relativePath.includes('/test-support/') &&
    !relativePath.includes('/generated/') &&
    relativePath !== 'src/architecture/testing/api-acid-coverage.spec.ts'
  );
}

function findTransactionOwnerFiles() {
  return walkFiles(sourceRoot)
    .filter(isProductionSourceFile)
    .filter((path) => readSource(path).includes('runSerializableTransaction'))
    .map(relativeApiPath)
    .sort();
}

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }
    seen.add(value);
  }

  return sorted([...duplicates]);
}

function missingPaths(actual: readonly string[], expected: readonly string[]) {
  const expectedSet = new Set(expected);
  return actual.filter((path) => !expectedSet.has(path));
}

function stalePaths(actual: readonly string[], expected: readonly string[]) {
  const actualSet = new Set(actual);
  return expected.filter((path) => !actualSet.has(path));
}

describe('API ACID coverage inventory boundary', () => {
  it('keeps production Serializable transaction owners registered with coverage metadata', () => {
    const actualPaths = findTransactionOwnerFiles();
    const registryPaths = sorted(acidCoverageInventory.map((entry) => entry.path));

    expect(duplicateValues(registryPaths)).toEqual([]);
    expect({
      missingInRegistry: missingPaths(actualPaths, registryPaths),
      staleRegistryEntries: stalePaths(actualPaths, registryPaths),
    }).toEqual({
      missingInRegistry: [],
      staleRegistryEntries: [],
    });
  });

  it('keeps each registered transaction owner linked to an existing coverage reference', () => {
    const allowedCoverageClassSet = new Set<string>(allowedCoverageClasses);

    for (const entry of acidCoverageInventory) {
      expect(entry.owner, `${entry.path} owner`).not.toHaveLength(0);
      expect(entry.rationale, `${entry.path} rationale`).not.toHaveLength(0);
      expect(allowedCoverageClassSet.has(entry.coverageClass), `${entry.path} coverageClass`).toBe(
        true,
      );
      expect(entry.coverageRefs, `${entry.path} coverageRefs`).not.toHaveLength(0);

      for (const coverageRef of entry.coverageRefs) {
        expect(existsSync(join(apiRoot, coverageRef)), `${entry.path} -> ${coverageRef}`).toBe(
          true,
        );
      }
    }
  });

  it('documents the ACID coverage registry update rule for integration test authors', () => {
    const readme = readSource(join(apiRoot, 'test', 'integration', 'README.md'));

    expect(readme).toContain('api-acid-coverage.spec.ts');
    expect(readme).toContain('runSerializableTransaction');
    expect(readme).toContain('coverageRefs');
    expect(readme).toContain('Phase 4~7 또는 follow-up으로 명시');

    for (const coverageClass of allowedCoverageClasses) {
      expect(readme).toContain(`\`${coverageClass}\``);
    }
  });
});
