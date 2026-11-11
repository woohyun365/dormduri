# Backup and restore drill runbook

이 runbook은 RDS automated backup/PITR 또는 manual snapshot이 실제로 복구 가능한지 검증하기 위한 production release gate다. 목표는 production DB를 직접 변경하지 않고 temporary restored DB에서 migration baseline, DB role grants, credential boundary, API readiness를 확인하는 것이다.

실행 결과는 아래 형식으로 [실제 값의 기록 위치](../../release/production-release-evidence.md#실제-값의-기록-위치)에
남긴다. 식별자는 값을 적지 않고 Owner console 위치와 확인 여부만 적는다. 이 runbook은 전체 release의 최종
판정을 소유하지 않는다.

첫 production release 전에 한 번, 그 뒤 분기마다 한 번 실행한다. 목표는 RPO 10분·RTO 2시간이다
(`infra/aws/rds-setup-checklist.md` Initial RPO / RTO target). 같은 날 `infra/db/README.md` 유지보수 절의
분기 점검을 한다.

## 실행 경로

복원 DB는 원본과 같은 DB subnet group과 security group으로 만든다. 그 security group은 user host 주소 하나에서 오는
5432만 받으므로(`infra/aws/rds-setup-checklist.md` Security group) GitHub-hosted runner나 operator 노트북은 복원 DB에
바로 닿지 않는다. 그래서 drill은 operator가 user host를 거쳐 수동으로 하고, GitHub Actions workflow는 두지 않는다.
복원 instance의 생성·삭제는 Owner console에서 한다. Production migration·runtime credential은 host role만 꺼내 user host의
임시 파일에 두고, 노트북에는 자기 사람 조회 user 비밀번호만 둔다.

| 단계                         | 경로                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 사람 조회(3·9)               | operator 노트북 → SSM 포트 포워딩(`AWS-StartPortForwardingSessionToRemoteHost`, user host 경유) → DB. 자기 사람 조회 user(`dormduri_ro_<별칭>`)만 쓴다. URL host는 그 DB endpoint 이름이고 `hostaddr=127.0.0.1`과 터널 port로 붙으며 CA는 노트북의 RDS CA 파일이다(`infra/db/README.md` RDS SSL / CA bundle) |
| Role grant와 DB smoke(10·11) | user host에서 배포한 migrate image의 one-off(`grant`·`restore-drill`, SSM Run Command). secret은 host role이 꺼내 파일 단위로 mount한다                                                                                                                                                                      |
| API readiness(12·13)         | user host의 임시 API container(compose 밖 `docker run`, SSM Run Command). 결과는 host 안 `http://127.0.0.1:<임시 port>`로 본다                                                                                                                                                                               |

## Required inputs

- Release commit SHA: 지금 배포한 API 묶음의 commit.
- Source DB identifier: 운영자가 console에서 확인만 하고 evidence에는 쓰지 않는다.
- Restore source: automated backup/PITR timestamp(기본, 최근 migrate 시작 시각 또는 지정 시각) 또는 manual snapshot.
- Temporary restored DB: 이름은 운영자가 정하고 evidence에는 쓰지 않는다. 그 endpoint 이름은 Run Command parameter로만 넘기고
  11의 기대 host(`RESTORE_DRILL_EXPECTED_HOST`)로 쓴다.
- Operator 별칭. 실행 경로는 위 [실행 경로](#실행-경로)다(host 이름·주소는 적지 않음).
- Evidence output 위치.
- 지금 배포한 API·migrate image digest(`deploy-api-*` 단계 기록 Release의 묶음). migrate image가 그 commit의 migration
  디렉터리와 RDS CA(`/etc/dormduri/rds-ca/root.pem`)를 담으므로 smoke의 마지막 migration 대조와 TLS 검증이 배포한 commit
  기준이 된다.
- 복원 DB용 secret: host role이 runtime 묶음 `/dormduri/production/api/runtime`과 migration 묶음
  `/dormduri/production/api/migration`을 꺼내 DB URL 넷(`MIGRATION_DATABASE_URL`·`DATABASE_URL`·`RETENTION_WORKER_DATABASE_URL`·
  `RETENTION_DISCLOSURE_DATABASE_URL`)의 host만 복원 endpoint로 바꾼다. 원본 endpoint는 바꾸기 전 migration 묶음 URL의 host다
  (11의 `RESTORE_DRILL_SOURCE_HOST`). 나머지 runtime key와 `METRICS_BEARER_TOKEN`은 그대로 쓴다. optional `DB_GRANT_SCHEMA`.

## Safety rules

- Production source DB에서 fixture seed, reset, destructive DDL/DML을 실행하지 않는다.
- Restore target은 production DB가 아니라 temporary DB여야 한다. 11의 `restore-drill`이 URL 넷의 host를 복원 endpoint와
  대조해(원본 endpoint와 같거나 `hostaddr`를 두면 거부) 강제하고, role grant와 임시 API는 그 확인을 통과한 파일만 쓴다.
- DB URL, password, bearer token, HMAC secret은 issue/report/log/evidence에 붙이지 않는다.
- Restore drill evidence 없이 production ready로 표시하지 않는다.
- Instance·snapshot·security group 식별자, endpoint, account는 evidence에 쓰지 않는다. 공개 저장소와 이슈에는 식별자 없는 판정만 남긴다.
- Production migration·runtime credential은 host role이 꺼낸 user host 임시 파일에만 둔다. 노트북·shell history·Run Command
  parameter·container env(`docker inspect`에 남음)에 넣지 않는다.
- 임시 container는 compose project 밖에서 띄워(compose label 없음) production `api` container를 다시 만들지 않고 Alloy가
  log를 모으지 않게 한다. API transit·관측 network와 production port에 붙이지 않는다.

## Procedure

1. Release commit SHA를 기록한다.
2. RDS automated backup retention(14일), PITR 가능 window(latest restorable time), 최근 manual snapshot 상태를 확인한다.
3. 원본에서 기준 값을 읽어 기록한다: 기록 시각(UTC), `_prisma_migrations`의 마지막 migration 이름, 주요 table
   (`User`·`SeasonParticipant`·`ConversationMessage`·`RetentionCase`) 행 수. 자기 사람 조회 user
   (`dormduri_ro_<별칭>`, SSM 포트 포워딩)로 접속해 읽기 전용 transaction(`BEGIN READ ONLY`)에서 `count(*)`와 migration
   이름만 읽는다. 이 user의 문장은 모두 pgAudit에 남는다. `RetentionCase`는 `id` 열만 열려 있어 행 수만 셀 수 있다.
   migration·app credential과 master user를 사람 조회에 쓰지 않는다(migration user는 CD one-off 전용, master는
   break-glass 전용).
4. 3의 기록 시각으로 PITR 복원을 요청하고 요청 시각을 기록한다. 원본 production DB가 아닌 temporary restored DB를
   새 instance로 만든다. 복원 시각이 latest restorable time 안인지 기록한다.
5. Temporary restored DB가 available이 된 시각을 기록한다.
6. Temporary restored DB의 public access가 off인지 확인한다.
7. Temporary restored DB가 원본과 같은 DB subnet group·security group(user host 주소 하나의 5432)·parameter group
   (`infra/aws/rds-setup-checklist.md`, `pgaudit` preload)을 쓰는지 확인한다. 복원 화면의 기본 parameter group이면
   `pgaudit`이 load되지 않아 11의 smoke가 실패한다. drill 때문에 inbound를 넓히지 않는다.
8. Restored DB connection string이 서버 인증서와 host 이름을 검증하는지 확인한다(runtime `verify-full` + 단일 루트,
   migration은 Prisma 형식 `sslmode=require&sslcert=<루트>&sslaccept=strict`, psql은 `infra/db/psql-tls.sh`. 복원 DB는
   endpoint 이름이 다르므로 URL host를 그 endpoint로 바꾼다. `infra/db/README.md` RDS SSL / CA bundle). migrate entrypoint는
   검증하지 않는 형식이면 client를 부르기 전에 64로 끝난다.
9. Restored DB에 3과 같은 사람 조회 user로 접속해(복원 DB는 원본의 role을 그대로 가진다) 같은 읽기 전용 query로
   마지막 migration 이름과 주요 table 행 수가 3의 값과 같은지, `pgaudit` extension이 있는지(`pg_extension`) 본다.
10. User host에서 SSM Run Command(root)로 복원 DB용 secret을 준비한다. 복원 endpoint는 parameter로 받는다. Host role로 두
    묶음을 꺼내 migration 묶음 URL의 host를 원본 endpoint로 읽고, 복원 endpoint와 같으면 멈춘다. URL 넷의 host만 복원
    endpoint로 바꿔 root 전용 임시 디렉터리(0700)에 key별 0400 파일(소유 10001)로 쓴다. 값은 출력하지 않는다.
11. 같은 파일로 migrate image의 `restore-drill`을 부른다. entrypoint는 먼저 URL 넷이 TLS 검증 형식인지, 모두 host가 복원
    endpoint(`RESTORE_DRILL_EXPECTED_HOST`)이고 `hostaddr`가 없는지, 원본 endpoint(`RESTORE_DRILL_SOURCE_HOST`)와 복원 endpoint가
    다른지 보고, 하나라도 아니면 client를 부르기 전에 64로 끝난다. 그 뒤 PostgreSQL major, 마지막 적용 migration(image 안
    migration 디렉터리의 마지막과 같음), `pgaudit` extension·preload를 보고 LOGIN user별 credential boundary smoke를 한다. 배포
    document의 migrate one-off와 같이 파일 단위로만 mount한다. Role smoke만 실패하면(grant drift) 대상 확인을 통과한 같은
    `MIGRATION_DATABASE_URL` 파일로 migrate image의 `grant`를 restored DB에 부르고 11을 다시 한다.

    ```bash
    docker run --rm --read-only --tmpfs /tmp:size=64m,mode=1777 --cap-drop ALL --security-opt no-new-privileges:true \
      --memory 384m --pids-limit 256 -e CHECKPOINT_DISABLE=1 -e MIGRATE_SECRET_DIRECTORY=/run/secrets/dormduri-migrate \
      -e RESTORE_DRILL_EXPECTED_HOST='<복원 endpoint>' -e RESTORE_DRILL_SOURCE_HOST='<원본 endpoint>' \
      -v '<임시 migrate 디렉터리>/MIGRATION_DATABASE_URL:/run/secrets/dormduri-migrate/MIGRATION_DATABASE_URL:ro' \
      -v '<임시 migrate 디렉터리>/DATABASE_URL:/run/secrets/dormduri-migrate/DATABASE_URL:ro' \
      -v '<임시 migrate 디렉터리>/RETENTION_WORKER_DATABASE_URL:/run/secrets/dormduri-migrate/RETENTION_WORKER_DATABASE_URL:ro' \
      -v '<임시 migrate 디렉터리>/RETENTION_DISCLOSURE_DATABASE_URL:/run/secrets/dormduri-migrate/RETENTION_DISCLOSURE_DATABASE_URL:ro' \
      '<migrate image digest>' restore-drill
    ```

12. User host에 임시 API container를 SSM Run Command로 띄운다. 띄우기 전 host `MemAvailable`이 그 memory 상한 + 512MiB보다
    작으면 띄우지 않고 drill을 다른 때로 미룬다(production container를 멈추지 않는다).
    - secret: runtime 묶음 13 key를 production release와 같은 형식(디렉터리 0500·파일 0400, 소유 10001:10001,
      `infra/aws/secrets-manager-checklist.md` Host 전달)의 임시 디렉터리에 쓴다. DB URL 셋은 11에서 대상 확인을 통과한 임시
      migrate 디렉터리의 같은 key 파일을 복사하고 `cmp`로 같은지 확인한다(다르면 띄우지 않음). 나머지 10 key는 runtime 묶음
      그대로다. 그 디렉터리를 `/run/secrets/dormduri-api`에 read-only로 mount한다(`SECRET_SOURCE=mounted-files`).
    - env: 지금 돌고 있는 production `api` container의 env(`docker inspect`의 `Config.Env`. secret은 파일이라 값이 없다)를
      root 전용 env 파일로 옮기고 예약 작업 셋을 `LIFECYCLE_SWEEP_ENABLED=false`, `AUTH_MAIL_DISPATCHER_ENABLED=false`,
      `CHAT_REALTIME_DISPATCHER_ENABLED=false`(notification outbox dispatcher도 이 설정을 쓴다)로 바꾼다. 복원 DB의 데이터로
      정리 작업이 돌거나 메일·알림이 나가지 않게 한다.
    - 실행: API 조각 `api` service와 같은 image digest·hardening·상한으로, compose 밖에서 production과 다른 이름과 host
      `127.0.0.1`의 임시 port로 띄운다(Docker 기본 bridge network).

    ```bash
    docker run -d --name dormduri-restore-drill-api --init --read-only --tmpfs /tmp:size=64m,mode=1777 \
      --cap-drop ALL --security-opt no-new-privileges:true --memory 1408m --pids-limit 512 \
      --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
      --env-file '<임시 env 파일>' -v '<임시 API secret 디렉터리>:/run/secrets/dormduri-api:ro' \
      -p '127.0.0.1:<임시 port>:4000' '<API image digest>'
    ```

13. Host 안에서 API readiness와 metrics guard를 확인하고 smoke가 끝난 시각을 기록한다. 4의 요청 시각부터 이 시각까지가
    RTO다. Host에는 저장소가 없으므로 `infra/deploy/scripts/api-release-smoke.sh` 내용을 Run Command로 보내 실행한다.

    ```bash
    API_BASE_URL='http://127.0.0.1:<임시 port>' \
    METRICS_BEARER_TOKEN="$(cat '<임시 API secret 디렉터리>/METRICS_BEARER_TOKEN')" \
      sh api-release-smoke.sh
    ```

14. Evidence artifact에 아래 secret 없는 정보만 기록한다(식별자도 쓰지 않는다).
15. 임시 API container, 임시 secret 디렉터리 둘(migrate·API)과 임시 env 파일을 지우고, 노트북의 포트 포워딩을 닫은 뒤
    temporary restored DB(과 drill 중 만든 snapshot)를 삭제하고 삭제를 확인한다. 삭제할 때 final snapshot을 만들지 않고
    자동 백업 보존(retain automated backups)을 끈다. 남은 보존 백업이 있으면 지운다(복원 DB도 production 데이터 사본이다).
16. Cleanup 완료 시각과 담당자를 evidence에 기록한다.

## Evidence template

```txt
release_sha=<commit-sha>
restore_source=pitr|manual-snapshot
restore_point=<iso8601>
restore_point_within_latest_restorable_time=yes|no
rpo_target_minutes=10
rto_target_minutes=120
restore_requested_at=<iso8601>
restore_available_at=<iso8601>
restore_target_verified=pass|fail
smoke_completed_at=<iso8601>
rto_observed_minutes=<number>
migration_baseline=pass|fail
last_migration_matches_source=pass|fail
row_counts_match_source=pass|fail
pgaudit_extension=pass|fail
role_grant_smoke=pass|fail
api_ready_smoke=pass|fail
metrics_guard_smoke=pass|fail
cleanup=pass|fail
drill_result=pass|fail
evidence_owner=<operator-alias>
notes=<secret-free-summary>
```

`drill_result=pass`는 위 pass|fail 칸이 모두 `pass`이고 `restore_point_within_latest_restorable_time=yes`이며
`rto_observed_minutes`가 `rto_target_minutes` 이하일 때만 쓴다. RTO만 넘었으면 `drill_result=fail`로 두고 원인(데이터
크기·instance class·절차)을 `notes`에 적어 목표를 다시 본다. Instance·snapshot 식별자, endpoint, 행 수 원값은 적지
않는다(행 수는 일치 여부만).

## Dry-run

Repo-local static/dry-run 검증은 AWS 리소스를 만들지 않는다.

```bash
pnpm api:db:restore-drill:smoke -- --dry-run
infra/deploy/scripts/api-release-smoke.sh --dry-run
```

Dry-run은 command shape와 secret boundary만 확인한다. Release evidence로 인정되는 restore drill은 실제 restored DB에서 실행한 결과여야 한다.

## Failure handling

- Migration baseline 확인 실패: restore source timestamp/snapshot과 release commit의 migration compatibility를 확인하고 release를 중지한다.
- 대상 확인 실패(11이 role smoke 전에 64로 끝남): role grant·임시 API로 넘어가지 않는다. 10의 host 치환과 두 endpoint
  parameter를 다시 보고 임시 파일을 지운 뒤 10부터 다시 한다. `restore_target_verified=fail`이면 drill을 통과로 적지 않는다.
- Role grant smoke 실패: restored DB grant drift를 확인하고 11의 grant 절차(대상 확인을 통과한 파일)로 `infra/db/README.md`의
  role grant apply 순서를 반복한다.
- 마지막 migration 이름이나 행 수 불일치: 복원 시각과 3의 기록 시각이 같은지 확인하고 다시 복원한다. 같아도 다르면 drill을 실패로 기록한다.
- `pgaudit` extension 없음: 원본 parameter group·extension 상태를 `infra/aws/rds-setup-checklist.md` 기준으로 확인한다.
- `/health/ready` 실패: restored DB 연결·migration baseline과 process bootstrap receipt를 확인한다. Secret origin/provider 상세는 public health가 아니라 component release evidence에서 확인한다.
- 중간 단계 실패: 어느 단계에서 멈춰도 그 자리에서 임시 container, 임시 secret 디렉터리 둘과 임시 env 파일을 지운다(배포
  document의 migrate 임시 디렉터리처럼 성공·실패와 관계없이). 복원 instance 삭제는 15를 따른다.
- Cleanup 실패: temporary restored DB가 남아 있는 상태로 release ready를 표시하지 않는다.
