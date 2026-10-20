# Domain/SWE/Web/DB

[Domain/SWE/Web pack](./README.md)의 DB layer입니다. schema 설계와 삭제 동작·이력, migration·seed와 배포 사이의 호환,
index·query와 raw SQL, DB 수준 무결성·보존 기한 삭제·DB 계정을 다룹니다. 하위 layer마다 상속, 결정 목록, 구현 지침(기준 항목
인용), 검증 기준(항목 id), 위험, binding 키를 둡니다.

## schema-modeling

`Domain/SWE/Web/DB/schema-modeling`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### db.schema.id-strategy

- 수준: `architecture-style`
- 질문: row 식별자를 무엇으로 할까?
- 선택지:
  - 무작위·시간순 UUID: 추측할 수 없는 긴 식별자를 쓰고, 시간순 형식이면 만든 순서대로 정렬된다. 밖에 보여도 안전하고 여러 곳에서 따로 만들 수 있지만 저장 공간이 크다
  - 자동 증가 정수: DB가 1, 2, 3처럼 번호를 매긴다. 작고 빠르지만 밖에 보이면 다른 row의 id를 추측할 수 있다. 외부에 노출하면 연결된 기준 항목 `web-security-privacy-trust-authz-model.md P3`이 결함으로 본다
  - 업무 key(자연 key): 상품 code처럼 업무에서 쓰는 값을 식별자로 쓴다. 따로 id를 두지 않지만 그 값이 바뀌면 모든 참조를 고쳐야 한다
- 먼저 정할 결정: 없음
- 되돌림: `one-way`. 모든 table·외래 key·URL·외부 참조를 옮긴다
- 기본값: 무작위·시간순 UUID. 외부에 노출해도 추측되지 않고 시간순이면 index도 효율적이다. 내부 전용 table이고 저장 공간이 중요하면 정수를 쓴다
- 확인 단서: `{{binding:repo-structure.db-schema}}`의 id field 정의
- 기준 항목: [web-db-schema-modeling.md T1](../../review-criteria/web-db-schema-modeling.md#t1-model-owner제약삭제-동작), [web-db-schema-modeling.md T3](../../review-criteria/web-db-schema-modeling.md#t3-명명type-규약), [web-security-privacy-trust-authz-model.md P3](../../review-criteria/web-security-privacy-trust-authz-model.md#p3-열거추측재전송빈도-남용-방어)

#### db.schema.history-model

- 수준: `code-pattern`
- 질문: 변경 이력을 어떻게 남길까?
- 선택지:
  - 별도 이력·snapshot table: 바뀔 때마다 이전 값을 따로 table에 남긴다. 현재 값을 바꿔도 과거 기록이 남고 공개 범위를 따로 정할 수 있지만 table과 쓰기가 늘어난다
  - 현재 row 안에 이력 필드: 현재 row에 이전 값·변경 시각 field를 둔다. table이 늘지 않지만 row가 커지고 이력과 현재 값의 공개 범위를 나누기 어렵다
  - 남기지 않음: 현재 값만 둔다. 가장 단순하지만 과거 값을 확인할 수 없다. 이력·감사가 필요한 data이면 연결된 기준 항목 `web-db-schema-modeling.md T2`이 결함으로 본다
- 먼저 정할 결정: `db.schema.id-strategy`
- 되돌림: `costly`. 이력 table과 조회 경로를 다시 쓴다
- 기본값: 별도 이력·snapshot table. 현재 값을 바꿔도 과거 기록이 남고 공개 범위를 따로 정할 수 있다. 이력이 필요 없는 data면 남기지 않는다
- 확인 단서: `{{binding:repo-structure.db-schema}}`의 snapshot·history model
- 기준 항목: [web-db-schema-modeling.md T2](../../review-criteria/web-db-schema-modeling.md#t2-snapshothistory와-현재-row-분리)

#### db.schema.delete-behavior

- 수준: `code-pattern`
- 질문: 부모 row를 지울 때 연결된 row를 어떻게 할까?
- 선택지:
  - 삭제 막기(restrict): 연결된 row가 있으면 부모 삭제를 거부한다. 의도하지 않은 삭제가 없지만 지우는 순서를 code가 맞춰야 한다
  - 함께 삭제(cascade): 부모를 지우면 연결된 row도 지운다. 정리가 쉽지만 생각보다 많은 row가 함께 지워질 수 있다
  - 참조 비우기(set null): 부모를 지우면 연결된 row의 참조를 비운다. 자식 row를 남기지만 참조가 빈 row가 남는다
  - 표시만 삭제: 지웠다는 표시만 하고 row를 남긴다. 되살리기 쉽지만 값이 그대로 남는다. 개인정보 삭제 정책이 물리 삭제면 연결된 기준 항목 `web-security-privacy-data-privacy-secret.md P3`이 결함으로 본다
- 먼저 정할 결정: `sec.privacy.deletion-mode`
- 되돌림: `costly`. 관계 정의와 data를 정리한다
- 기본값: 관계마다 명시. 기본은 삭제 막기이고, 부모 없이는 의미가 없는 row만 함께 삭제한다. 개인정보 삭제 정책이 물리 삭제면 표시만 삭제를 쓰지 않는다
- 확인 단서: `{{binding:repo-structure.db-schema}}`의 relation 삭제 동작
- 기준 항목: [web-db-schema-modeling.md T1](../../review-criteria/web-db-schema-modeling.md#t1-model-owner제약삭제-동작), [web-security-privacy-data-privacy-secret.md P3](../../review-criteria/web-security-privacy-data-privacy-secret.md#p3-보존-목적기한삭제비식별)

### 구현 지침

- [web-db-schema-modeling.md T1](../../review-criteria/web-db-schema-modeling.md#t1-model-owner제약삭제-동작)
- [web-db-schema-modeling.md T2](../../review-criteria/web-db-schema-modeling.md#t2-snapshothistory와-현재-row-분리)
- [web-db-schema-modeling.md T3](../../review-criteria/web-db-schema-modeling.md#t3-명명type-규약)

### 검증 기준

- `web-db-schema-modeling.md T1`
- `web-db-schema-modeling.md T2`
- `web-db-schema-modeling.md T3`

### 위험

- code에만 맡긴 무결성과 기본값에 맡긴 삭제 동작(T1), 현재 값과 함께 바뀌는 과거 기록과 version·공개 범위 없는 snapshot(T2), 같은 의미의 다른 이름·type(T3), 외부에 노출한 추측 가능한 id(trust-authz-model P3)
- 비가역 선택: `db.schema.id-strategy`(`one-way`). `db.schema.history-model`과 `db.schema.delete-behavior`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.db-schema}}`: DB schema 정의 파일의 위치

## migration-seed-compatibility

`Domain/SWE/Web/DB/migration-seed-compatibility`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-operations-release-release-gate.md O2](../../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)

### 결정 목록

#### db.migration.change-strategy

- 수준: `policy`
- 질문: schema를 바꿀 때 옛 app과 새 app이 함께 도는 구간을 어떻게 지킬까?
- 선택지:
  - 확장 뒤 축소(expand-contract) 여러 배포: 먼저 새 열·table을 더해 옛 app과 새 app이 함께 동작하게 하고, 새 app이 자리 잡은 뒤 옛 것을 지운다. 무중단 배포와 되돌림이 가능하지만 한 변경이 여러 배포에 걸친다
  - 점검 시간에 한 번에: 서비스를 잠시 멈추고 schema와 app을 함께 바꾼다. 절차가 단순하지만 그동안 사용자가 쓸 수 없다
  - 배포마다 판단: 변경마다 위험을 보고 방식을 고른다. 유연하지만 판단 기준이 사람마다 달라질 수 있다
- 먼저 정할 결정: `ops.release.rollback-mode`
- 되돌림: `costly`. 배포 횟수와 절차가 따라 바뀐다
- 기본값: 확장 뒤 축소. 무중단 배포와 되돌림이 가능하다. 사용자가 없는 단계거나 점검 시간을 낼 수 있으면 한 번에 바꾼다
- 확인 단서: `{{binding:repo-structure.db-migrations}}`의 migration 내용과 배포 순서 설명
- 기준 항목: [web-db-migration-seed-compatibility.md T1](../../review-criteria/web-db-migration-seed-compatibility.md#t1-위험-migration-패턴과-사람-승인), [web-db-migration-seed-compatibility.md T2](../../review-criteria/web-db-migration-seed-compatibility.md#t2-fresh현재-db-적용과-되돌림-경로), [web-operations-release-release-gate.md O2](../../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)

#### db.migration.rollback-path

- 수준: `operational`
- 질문: migration이 잘못되면 어떻게 돌아갈까?
- 선택지:
  - 다음 migration으로 고침(forward-fix): 잘못을 고치는 새 migration을 낸다. 이미 들어온 data를 잃지 않지만 고치는 동안 문제가 이어진다
  - 되돌리는 migration 실행: 적용한 변경을 반대로 되돌린다. 빠르게 이전 schema로 가지만 그 사이 들어온 data를 잃을 수 있다
  - backup에서 restore: 변경 전 backup으로 DB를 되돌린다. 확실히 이전 상태가 되지만 backup 뒤 들어온 data를 잃고 오래 걸린다
- 먼저 정할 결정: `db.migration.change-strategy`, `ops.release.rollback-mode`
- 되돌림: `costly`. 되돌림 절차와 연습을 준비한다
- 기본값: forward-fix. 이미 들어온 data를 잃지 않는다. data가 없거나 다시 만들 수 있는 변경이면 되돌리는 migration도 쓸 수 있다. restore는 마지막 수단이다
- 확인 단서: `{{binding:repo-structure.db-migrations}}`의 forward-fix 이력
- 기준 항목: [web-db-migration-seed-compatibility.md T2](../../review-criteria/web-db-migration-seed-compatibility.md#t2-fresh현재-db-적용과-되돌림-경로), [web-operations-release-release-gate.md O2](../../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)

#### db.migration.seed-scope

- 수준: `code-pattern`
- 질문: seed로 무엇을 넣을까?
- 선택지:
  - 운영에 필요한 reference data만(시험 data는 따로): 운영에 꼭 필요한 기준 data(code 표·기본 설정)만 seed로 넣고 시험 data는 따로 둔다. 운영 DB에 시험 data가 들어가지 않지만 seed가 둘이 된다
  - 시험 data까지 한 seed: reference data와 시험 data를 한 seed로 넣는다. 개발 환경을 빨리 채우지만 운영에서 실행되면 시험 data가 들어간다. 운영 환경에서도 실행되면 연결된 기준 항목 `web-db-migration-seed-compatibility.md T3`이 결함으로 본다
  - seed 없이 migration에 data 포함: reference data를 migration 안에서 넣는다. 한 번만 실행돼 중복이 없지만 data 변경이 schema 이력에 섞인다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. seed를 나눈다
- 기본값: reference data만, 시험 data는 따로. 운영 DB에 시험 data가 들어가지 않고 두 번 실행해도 같다
- 확인 단서: `{{binding:repo-structure.db-seed}}`의 seed 구성과 실행 환경 검사
- 기준 항목: [web-db-migration-seed-compatibility.md T3](../../review-criteria/web-db-migration-seed-compatibility.md#t3-seed-멱등결정적-keyproduction-안전)

### 구현 지침

- [web-db-migration-seed-compatibility.md T1](../../review-criteria/web-db-migration-seed-compatibility.md#t1-위험-migration-패턴과-사람-승인)
- [web-db-migration-seed-compatibility.md T2](../../review-criteria/web-db-migration-seed-compatibility.md#t2-fresh현재-db-적용과-되돌림-경로)
- [web-db-migration-seed-compatibility.md T3](../../review-criteria/web-db-migration-seed-compatibility.md#t3-seed-멱등결정적-keyproduction-안전)

### 검증 기준

- `web-db-migration-seed-compatibility.md T1`
- `web-db-migration-seed-compatibility.md T2`
- `web-db-migration-seed-compatibility.md T3`

### 위험

- 옛 app과 새 app이 함께 도는 배포에서 한 번에 하는 열 삭제·이름 변경, data가 있는 table의 기본값 없는 필수 열, 서비스 중에 table을 오래 잠그는 migration(T1), 빈 DB에서만 한 확인과 배포된 migration의 수정(T2), 두 번 실행하면 중복되는 seed와 운영 환경의 시험 data(T3), 되돌림 경로 없는 release(상속한 release-gate O2)
- 비가역 선택: `db.migration.change-strategy`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴). `db.migration.rollback-path`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다
- 사람 승인 지점: 열·table 삭제 같은 파괴적 DDL은 agent가 계획·diff까지 만들고 사람이 backup을 확인해 승인한 뒤 실행한다(T1). 그 밖의 되돌릴 수 없는 운영 적용(data 삭제 등)도 agent가 계획·diff까지 만들고 사람이 승인한 뒤 실행한다(상속한 release-gate O2)

### binding 키

- `{{binding:repo-structure.db-migrations}}`: migration 파일의 위치
- `{{binding:repo-structure.db-seed}}`: seed script와 seed data의 위치

## index-query

`Domain/SWE/Web/DB/index-query`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-security-privacy-trust-authz-model.md P4](../../review-criteria/web-security-privacy-trust-authz-model.md#p4-주입xssopen-redirect)

### 결정 목록

#### db.query.raw-sql

- 수준: `code-pattern`
- 질문: raw SQL을 언제 어디에 쓸까?
- 선택지:
  - ORM으로 표현하기 어려운 query만 정해진 위치에 parameter binding으로: ORM(code의 객체로 DB를 다루는 도구)으로 표현하기 어려운 query만 정해진 위치에 SQL로 쓰고 값은 parameter로 넘긴다. 주입 위험이 없고 query를 한 곳에서 검토하지만 그 위치의 관례를 지켜야 한다
  - 필요한 곳 어디서나: 필요한 code에서 바로 SQL을 쓴다. 빨리 쓸 수 있지만 SQL이 흩어져 검토와 결과 검증이 빠지기 쉽다. 연결된 기준 항목 `web-db-index-query.md T2`이 결함으로 본다
  - 쓰지 않음: 모든 query를 ORM으로 쓴다. 주입 위험이 가장 적지만 ORM으로 표현하기 어려운 query는 비효율적으로 쓰게 된다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. query를 옮긴다
- 기본값: 어려운 query만, 정해진 위치에, binding으로. 주입 위험이 없고 query를 한 곳에서 검토한다
- 확인 단서: `{{binding:repo-structure.db-sql}}`, raw query 호출 위치 검색
- 기준 항목: [web-db-index-query.md T2](../../review-criteria/web-db-index-query.md#t2-raw-sql-위치와-parameter-binding), [web-security-privacy-trust-authz-model.md P4](../../review-criteria/web-security-privacy-trust-authz-model.md#p4-주입xssopen-redirect)

#### db.query.plan-check

- 수준: `operational`
- 질문: query 성능을 언제 확인할까?
- 선택지:
  - 핵심 query는 바꿀 때 실행 계획 확인: 자주 쓰거나 큰 table을 읽는 query를 바꿀 때 DB가 어떻게 실행할지(실행 계획)를 대표 data로 확인한다. 느린 query를 배포 전에 잡지만 핵심 query를 정해 둬야 한다
  - 문제가 생긴 뒤: 느려졌다는 신호가 오면 확인한다. 평소 비용이 없지만 사용자가 먼저 느린 화면을 겪는다. 연결된 기준 항목 `web-db-index-query.md T1`이 결함으로 본다
  - 모든 query: 바뀌는 모든 query의 실행 계획을 확인한다. 빠짐이 없지만 확인 비용이 크다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 검사 범위를 조정한다
- 기본값: 핵심 query를 바꿀 때. 느린 query가 배포되기 전에 잡히고 모든 query를 보는 비용은 피한다
- 확인 단서: `{{binding:repo-structure.db-sql}}`, `{{binding:repo-structure.db-schema}}`의 index, 실행 계획 기록
- 기준 항목: [web-db-index-query.md T1](../../review-criteria/web-db-index-query.md#t1-query-shape과-index실행-계획-확인), [web-be-background-integration-performance.md E3](../../review-criteria/web-be-background-integration-performance.md#e3-querypoolquota-포화-후보)

### 구현 지침

- [web-db-index-query.md T1](../../review-criteria/web-db-index-query.md#t1-query-shape과-index실행-계획-확인)
- [web-db-index-query.md T2](../../review-criteria/web-db-index-query.md#t2-raw-sql-위치와-parameter-binding)

### 검증 기준

- `web-db-index-query.md T1`
- `web-db-index-query.md T2`

### 위험

- 자주 쓰는 조건에 맞는 index 없는 조회와 확인하지 않은 실행 계획(T1), 문자열로 이은 SQL과 여러 곳에 흩어진 raw SQL(T2, 상속한 trust-authz-model P4)
- 비가역 선택: 없음

### binding 키

- `{{binding:repo-structure.db-schema}}`: DB schema 정의 파일의 위치(index 정의 포함)
- `{{binding:repo-structure.db-sql}}`: raw SQL 파일의 위치

## integrity-retention-lifecycle

`Domain/SWE/Web/DB/integrity-retention-lifecycle`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-security-privacy-data-privacy-secret.md P3](../../review-criteria/web-security-privacy-data-privacy-secret.md#p3-보존-목적기한삭제비식별)

### 결정 목록

#### db.integrity.concurrency-control

- 수준: `code-pattern`
- 질문: 동시 수정 충돌을 어떻게 막을까?
- 선택지:
  - DB 제약·조건부 갱신 우선, 필요하면 공용 lock helper: unique·check 제약과 조건부 갱신으로 DB가 마지막에 막고, 여러 row를 함께 판정할 때만 공용 잠금 helper를 정해진 순서로 쓴다. 경쟁 상황에서도 DB가 막지만 제약으로 표현할 규칙을 찾아야 한다
  - version 열 낙관적 잠금: row에 version 열을 두고 읽은 version이 그대로일 때만 바꾼다. 잠금 대기가 없지만 충돌하면 사용자나 code가 다시 시도해야 한다
  - application 검사만: code가 읽고 확인한 뒤 쓴다. DB 규칙이 필요 없지만 동시 요청이 확인과 쓰기 사이에 끼어든다. DB 제약으로 막을 수 있는 경쟁이면 연결된 기준 항목 `web-db-integrity-retention-lifecycle.md T1`이 결함으로 본다
- 먼저 정할 결정: `be.txn.isolation-default`
- 되돌림: `easy`. 제약·helper를 더한다
- 기본값: DB 제약·조건부 갱신 우선. 경쟁 상황에서도 DB가 마지막에 막는다. 여러 row를 함께 판정해야 하면 공용 lock helper를 정해진 순서로 쓴다
- 확인 단서: `{{binding:repo-structure.db-schema}}`의 unique·check 제약, `{{binding:repo-structure.db-sql}}`의 잠금 query
- 기준 항목: [web-db-integrity-retention-lifecycle.md T1](../../review-criteria/web-db-integrity-retention-lifecycle.md#t1-db-제약lock-helperlock-순서), [web-be-transaction-concurrency-idempotency.md E1](../../review-criteria/web-be-transaction-concurrency-idempotency.md#e1-read-check-write-보호)

#### db.integrity.retention-execution

- 수준: `operational`
- 질문: 보존 기한 삭제를 어떻게 실행할까?
- 선택지:
  - 주기 작업이 기한 지난 row를 찾아 처리: 정해진 주기로 기한이 지난 row를 찾아 지우거나 익명화한다. 기한이 사람 기억에 기대지 않고 실행 기록이 남지만 작업을 운영해야 한다
  - 요청이 올 때 처리: 그 data를 다시 읽거나 사용자가 요청할 때 기한을 확인해 처리한다. 따로 작업이 없지만 아무도 읽지 않는 data는 기한이 지나도 남는다. 연결된 기준 항목 `web-security-privacy-data-privacy-secret.md P3`이 결함으로 본다
  - 수동 운영: 운영자가 정해진 때 대상을 찾아 실행한다. 자동화가 없어도 되지만 사람이 잊으면 기한을 넘긴다
- 먼저 정할 결정: `sec.privacy.deletion-mode`
- 되돌림: `easy`. 실행 방식을 바꾼다
- 기본값: 주기 작업. 기한이 사람 기억에 기대지 않고 실행 기록이 남는다. 대상이 아주 적으면 수동 운영과 checklist로 시작한다
- 확인 단서: `{{binding:policy.data-retention}}`, `{{binding:repo-structure.db-schema}}`의 보존 기한 field
- 기준 항목: [web-db-integrity-retention-lifecycle.md T2](../../review-criteria/web-db-integrity-retention-lifecycle.md#t2-보존-기한-삭제비식별-실행), [web-security-privacy-data-privacy-secret.md P3](../../review-criteria/web-security-privacy-data-privacy-secret.md#p3-보존-목적기한삭제비식별)

#### db.integrity.role-separation

- 수준: `policy`
- 질문: DB 접속 계정을 어떻게 나눌까?
- 선택지:
  - app 실행 계정과 migration 계정 분리, 최소 grant: app은 쓰는 table에 필요한 권한만 가진 계정으로, migration은 schema 변경 권한을 가진 따로 된 계정으로 실행한다. app이 schema를 바꾸거나 지울 수 없지만 계정과 grant를 관리해야 한다
  - 계정 하나: app과 migration이 같은 계정을 쓴다. 설정이 단순하지만 app이 schema를 바꾸거나 table을 지울 수 있다. 연결된 기준 항목 `web-db-integrity-retention-lifecycle.md T3`이 결함으로 본다
  - 기능별 여러 계정: 기능마다 다른 계정과 grant를 둔다. 권한이 더 잘게 나뉘지만 계정·grant 관리가 늘어난다
- 먼저 정할 결정: 없음
- 되돌림: `costly`. 계정·grant·배포 설정을 바꾼다
- 기본값: 실행·migration 계정 분리와 최소 grant. app이 schema를 바꾸거나 지울 수 없다. 기능별 계정은 권한 경계가 실제로 다를 때만 더한다
- 확인 단서: `{{binding:repo-structure.db-role-grants}}`의 grant 정의
- 기준 항목: [web-db-integrity-retention-lifecycle.md T3](../../review-criteria/web-db-integrity-retention-lifecycle.md#t3-db-계정-분리와-최소-grant)

### 구현 지침

- [web-db-integrity-retention-lifecycle.md T1](../../review-criteria/web-db-integrity-retention-lifecycle.md#t1-db-제약lock-helperlock-순서)
- [web-db-integrity-retention-lifecycle.md T2](../../review-criteria/web-db-integrity-retention-lifecycle.md#t2-보존-기한-삭제비식별-실행)
- [web-db-integrity-retention-lifecycle.md T3](../../review-criteria/web-db-integrity-retention-lifecycle.md#t3-db-계정-분리와-최소-grant)

### 검증 기준

- `web-db-integrity-retention-lifecycle.md T1`
- `web-db-integrity-retention-lifecycle.md T2`
- `web-db-integrity-retention-lifecycle.md T3`

### 위험

- application 검사로만 막은 경쟁과 경로마다 다른 잠금 순서(T1), 관련 table을 남기는 삭제와 다시 식별되는 익명화, 기록 없는 삭제(T2), schema 변경 권한으로 접속하는 app과 agent·개발 환경의 운영 쓰기 자격 증명(T3), 기한이 지나도 남는 개인정보(상속한 data-privacy-secret P3)
- 비가역 선택: 없음. `db.integrity.role-separation`은 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다
- 사람 승인 지점: 운영 DB의 grant·data를 바꾸는 작업은 agent가 계획·diff까지 만들고, 운영 쓰기 자격 증명을 가진 사람이 승인해 실행한다(T3). 운영 data에 되돌릴 수 없는 보존 기한 삭제·익명화는 그 실행 경로(일회성 실행이나 주기 작업의 대상 규칙)를 만들거나 바꿀 때 사람이 대상 범위를 승인하고, 승인된 대상 규칙의 주기 실행은 실행 기록을 남긴다(상속한 data-privacy-secret P3)

### binding 키

- `{{binding:repo-structure.db-schema}}`: DB schema 정의 파일의 위치(제약·보존 기한 field 포함)
- `{{binding:repo-structure.db-sql}}`: raw SQL 파일의 위치(잠금 query 포함)
- `{{binding:repo-structure.db-role-grants}}`: DB 역할·grant 정의의 위치
- `{{binding:policy.data-retention}}`: 보존·삭제 정책 원본
