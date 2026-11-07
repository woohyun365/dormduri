# DB 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-11-07
**확인 근거**: [#862의 DB 결정 기록 댓글](https://github.com/woohyun365/dormduri/issues/862#issuecomment-6708394110)(migration-seed-compatibility의 `db.migration.change-strategy`·`db.migration.rollback-path`, integrity-retention-lifecycle의 `db.integrity.role-separation`·`db.integrity.retention-execution`과 pack 밖 결정의 Owner 확인 날짜)
**근거**: [Database operator scripts](../../../infra/db/README.md), [RDS setup and backup checklist](../../../infra/aws/rds-setup-checklist.md), [Backup and restore drill runbook](../../../infra/runbooks/operations/database/backup-restore.md), [Data retention](../../policies/data-retention.md#rrpd-db-접근-통제와-운영-관측), [Domain/SWE/Web/DB pack](../../development/agent-workflows/domain/swe-web/db.md)

`Domain/SWE/Web/DB` pack layer의 결정 기록입니다. 형식과 상태 어휘는 [Decision records](./README.md)입니다.

## schema-modeling

#### db.schema.package-location

- 판정: Ask
- 상태: validated
- 고른 선택지: 공유 DB package `packages/database`(`@repo/database`)가 `schema.prisma`, `migrations/`, typed SQL, role grant
  자산, Prisma config, generated client를 소유한다. 사용자 API 개발·test seed와 `PrismaService`·driver adapter·pool 설정은
  `apps/api`에 남는다. Schema는 `public` 하나다
- 근거: 사용자 API와 백오피스 API가 같은 schema·client를 쓰므로 한 곳에서 생성한다. 경계는 table별 grant와 미분류 0 검사가
  맡아 schema를 나눌 필요가 없다. 옮긴 PR은 동작을 바꾸지 않았다
- 기각한 대안: 이동과 role pipeline을 한 PR로(diff가 커서 리뷰·되돌림이 어려움), app마다 client 생성(generator output이 겹침),
  관리자·감사 table만 admin schema(Prisma multi-schema 설정·migration·typed SQL schema 한정이 늘어남)
- 재검토 조건: 백오피스 table이 늘어 schema 단위 기본 권한이 table별 grant보다 단순해질 때
- 출처: #849, Owner 확인 2026-11-04
- pack 결정: 없음

## migration-seed-compatibility

Release 순서와 실패 처리는 [Database operator scripts](../../../infra/db/README.md#release-order)가 소유합니다.

#### db.migration.change-strategy

- 판정: Ask
- 상태: validated
- 고른 선택지: initial baseline을 유지하고 첫 배포부터 앞으로만 간다(baseline을 다시 만들지 않고 table 변경은 새 migration).
  Owner가 사용자 release를 선언하기 전에는 schema·data 변경을 한 번에 하고 이전 image가 새 schema에서 깨질 수 있음을 받아들인다.
  선언 뒤에는 확장 뒤 축소(expand-contract)가 필수다. 규칙은 [Database operator scripts](../../../infra/db/README.md#release-order)다
- 근거: 사용자 release 전에는 production DB에 실제 사용자 data가 없어 schema·data 변경 비용이 낮다. Baseline 조사에서 구조
  문제는 없었고 문제는 모두 grant SQL 쪽이었다. 선언 뒤에는 옛·새 container가 겹치는 rollout에서 무중단이 필요하다
- 기각한 대안: 지금부터 expand-contract(사용자가 없는 단계에서 배포 수만 늘어남), baseline 재생성(이미 맞는 baseline을 다시
  검증해야 함)
- 재검토 조건: Owner가 사용자 release를 선언할 때, baseline을 고쳐야만 하는 구조 문제가 나올 때
- 출처: #849, #862, Owner 확인 2026-11-04
- pack 결정: [db.migration.change-strategy](../../development/agent-workflows/domain/swe-web/db.md#dbmigrationchange-strategy)

#### db.migration.rollback-path

- 판정: Ask
- 상태: validated
- 고른 선택지: CD 단계는 migrate → grant 적용 → LOGIN user별 smoke → rollout이다. 어느 단계든 실패하면 rollout하지 않고 멈추며
  사람이 원인을 보고 다음 migration으로 고친다(forward-fix). 자동 복원은 없다. 데이터가 망가졌을 때만 migrate 시작 시각으로
  PITR한다. 규칙은 [Database operator scripts](../../../infra/db/README.md#release-order) 실패 처리다
- 근거: 실패해도 이전 container가 계속 돌아 사용자 영향이 없다. RDS 복원은 새 instance·새 endpoint라 secret·security group을
  바꿔야 하고 CD에 RDS 생성 권한이 필요하다. 14일 PITR이 있어 release마다 snapshot을 따로 남기지 않는다
- 기각한 대안: schema 변경 release마다 직전 manual snapshot(PITR과 겹치고 snapshot 비용·삭제 관리가 늚), 자동 복원
- 재검토 조건: 사용자 release 뒤 무중단 목표가 생겨 rollout 실패 시간을 줄여야 할 때
- 출처: #237, Owner 확인 2026-11-04
- pack 결정: [db.migration.rollback-path](../../development/agent-workflows/domain/swe-web/db.md#dbmigrationrollback-path)

## integrity-retention-lifecycle

Role·LOGIN user·grant 표는 [Database operator scripts](../../../infra/db/README.md#credential-boundary)가, RRPD 접근 원칙은
[Data retention](../../policies/data-retention.md#rrpd-db-접근-통제와-운영-관측)이 소유합니다.

#### db.integrity.role-separation

- 판정: Ask
- 상태: validated
- 고른 선택지: 기능별 여러 계정. NOLOGIN group role(`migration_owner`, `app_runtime`, `retention_worker`, `retention_disclosure`,
  `app_readonly`, `backoffice_runtime`)이 권한을 갖고, 서비스·사람마다 LOGIN user가 group의 member로 접속한다. 객체는
  `migration_owner`가 소유하고, table마다 허용 권한은 grant 표 하나(`packages/database/prisma/role-grants/role-grant-matrix.csv`)가
  원본이다. Default privilege는 PUBLIC만 막고 앱 role에 자동 grant를 두지 않는다. 규칙은
  [Database operator scripts](../../../infra/db/README.md#grant-표)다
- 근거: RRPD payload·식별 복원 table은 worker·disclosure만, 감사 table은 append만, migration 기록은 사람 조회만 닿게 해야 해서
  권한 경계가 실제로 다르다. 사람 조회를 운영자별로 나누고 credential 교체를 group 권한과 떼려면 LOGIN user가 따로 있어야 한다.
  runtime은 일반 table DML을 유지하고, worker는 계정 삭제·archive가 실제로 쓰는 연산만 더 받는다(계정 삭제와 RRPD 보존이 한
  serializable transaction이다). 신고 접수는 runtime이 `RetentionCase` anchor를 INSERT하고 `id` 열만 읽는다. 사람 조회는 secret·
  content 열을 뺀다. 새 table은 표에 넣고 같은 release의 grant 단계가 돌아야 열린다. Connection 예산은 role별 pool과
  `max_connections` × 0.6 규칙이다([Connection budget](../../../infra/db/README.md#connection-budget))
- 기각한 대안: group role에 LOGIN 직접(운영자별로 나눌 수 없음), 서비스 이름으로 role을 새로 짓기(SQL·env·test 이름만 바뀜),
  계정 삭제를 나눠 사용자 table 변경을 runtime transaction으로(두 transaction 사이 실패 때 보존 없이 삭제되거나 그 반대),
  default privilege로 runtime에 새 table DML 자동 부여(RRPD·감사 table이 처음부터 열림), 사람 조회에 비밀 열만 제외(통신
  내용을 일상 권한으로 봄), pool 하나 유지, 80% 규칙(사람 비상 접속 자리가 줄어듦)
- 재검토 조건: 백오피스 기능이 사용자 table 열을 읽어야 할 때(열 단위로 더함), 관리자 감사 table을 만들 때, runtime 권한을
  table별로 더 좁힐 때, target `max_connections`가 규칙을 넘을 때
- 출처: #237, #238, #862, Owner 확인 2026-11-04(role·grant·예산)·2026-11-07(`migration_owner`의 database CREATE)
- pack 결정: [db.integrity.role-separation](../../development/agent-workflows/domain/swe-web/db.md#dbintegrityrole-separation)

#### db.integrity.retention-execution

- 판정: Ask
- 상태: validated
- 고른 선택지: 주기 작업. 정리 sweep과 outbox dispatcher는 사용자 API instance 하나 안에서 돌고, 작업마다 마지막 성공 시각과
  실패 수를 공통 metric으로 낸다([Background job metrics](../../../apps/api/src/background-jobs/README.md)). Rollout은 옛
  container를 멈춘 뒤 새 container를 시작해 두 container의 작업이 겹치지 않게 한다
- 근거: 기한이 사람 기억에 기대지 않고, 공통 metric 두 개로 경보 규칙 하나가 모든 작업의 멈춤·실패를 본다. Instance가 하나라
  분산 lease가 필요 없다
- 기각한 대안: lifecycle sweep DB lease를 지금 더함(instance 하나에서 쓰이지 않는 code), 별도 worker container(chat·notification
  dispatcher를 옮길 수 없고 재검토 조건이 아직 없음)
- 재검토 조건: 사용자 API instance가 2개 이상이 되거나 sweep이 응답 지연을 만들 때
- 출처: #862, Owner 확인 2026-11-04
- pack 결정: [db.integrity.retention-execution](../../development/agent-workflows/domain/swe-web/db.md#dbintegrityretention-execution)

#### db.integrity.audit-tables

- 판정: Ask
- 상태: validated
- 고른 선택지: 관리자 행위 감사는 append-only table 하나로 두고(관리자 계정 table과 함께 만듦), RRPD 열람 기록
  `RetentionAccessLog`는 따로 둔다. 지금 감사 table 둘은 쓰는 role이 INSERT·SELECT만 받는다(`SeasonOperationAuditEvent`는
  runtime, `RetentionAccessLog`는 disclosure). 열람 기록의 기한 폐기(열람자·목적 열을 비우는 UPDATE)는 worker만 한다
- 근거: RRPD 열람 기록은 보존·폐기 주기(3년)와 disclosure 권한이 관리자 감사와 다르다. 시즌 운영이 백오피스로 옮겨 가면 관리자
  감사가 시즌 운영 감사를 흡수해 감사가 두 곳으로 나뉘지 않는다. append-only는 grant 표와 smoke가 막는다
- 기각한 대안: 셋 다 한 table(RRPD 폐기와 관리자 감사 보존·권한이 섞임), 셋 다 따로(시즌 운영이 옮겨 오면 감사가 나뉨), 관리자
  감사 table을 관리자 계정보다 먼저(FK 없는 table을 나중에 다시 고침)
- 재검토 조건: 관리자 계정과 감사 table을 만들 때, 시즌 운영을 백오피스로 옮길 때
- 출처: #862, Owner 확인 2026-11-04
- pack 결정: 없음

#### db.integrity.recovery-target

- 판정: Ask
- 상태: validated
- 고른 선택지: RPO 5분·RTO 2시간. 값의 원본은 [RDS setup and backup checklist](../../../infra/aws/rds-setup-checklist.md#initial-rpo--rto-target)이고
  restore drill은 첫 production 전 한 번, 그 뒤 분기마다 한 번이다([Backup and restore drill runbook](../../../infra/runbooks/operations/database/backup-restore.md))
- 근거: RDS가 transaction log를 5분마다 올리므로 PITR로 잃는 데이터는 그 사이다. RTO는 복원 요청부터 복원 instance에 API를
  연결해 smoke를 통과할 때까지이고 single-AZ·작은 DB에서 사람이 진행하는 절차의 상한이다
- 기각한 대안: 목표 없이 첫 drill 실측만(통과 판정이 없음)
- 재검토 조건: 첫 drill 실측이 2시간을 넘을 때, 데이터 크기나 instance class가 바뀔 때, 사용자 release 뒤 가용성 목표가 생길 때
- 출처: #862, Owner 확인 2026-11-05
- pack 결정: 없음
