# API 단계 배포

API 단계(user host에 API 묶음 `api`·`migrate` one-off·관측 service 다섯과 관측 설정 image를 더한 단계)의 배포·재배포·rollback·API 내림 절차다. 실행은 GitHub
Actions workflow [`api-cd.yml`](../../../.github/workflows/api-cd.yml)이 하고, host에서 할 일은 SSM Command document
`dormduri-api-deploy`([API 배포 명령](../../deploy/README.md#api-배포-명령ssm-document))가 정한다. 신뢰 구조(승인 뒤 배포 전용
job, OIDC 단기 role, provenance, mask, 단계 기록)는 [Web 단계 배포](./web-stage-deploy.md)와 같고, 이 문서는 다른 점과 API·DB
고유 절차를 적는다. DB 단계 순서와 실패 처리는 [DB operator scripts](../../db/README.md#release-order)가, API·DB 되돌림 판단은
[API incident rollback decision guide](../incidents/release-rollback.md)가, 단계 기록 형식은
[단계 배포 기록](./production-release-evidence.md#단계-배포-기록)이 소유한다.

공개 저장소라 log·run 요약·Release·이슈·노트에 AWS account ID(registry host·ARN·role unique ID 포함), IP, node·instance ID,
email, secret 값, DB 연결 문자열을 쓰지 않는다([식별자 규칙](../../../docs/deploy/README.md#식별자-규칙)). 그런 값이 필요한
자리는 "Owner console"로 적는다. 이 workflow는 Secrets Manager와 DB에 닿지 않는다. secret은 host가 host role로 꺼내고 migrate는
host의 one-off container가 한다.

## Workflow 구성

| Job      | 실행 조건                                                | 권한·principal                                                               | 하는 일                                                                                                                                                                                                                                                                         |
| -------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`  | `main` push에서 API 배포 입력 경로가 바뀜                | `id-token: write`, API publish role(repository secret)                       | `infra/deploy/api/Dockerfile`의 `runtime`·`migrate` target과 관측 설정 image(`infra/observability/Dockerfile`)를 SBOM과 함께 OCI layout으로 build, image filesystem secret scan, digest 그대로 ECR `dormduri/api`·`dormduri/api-migrate`·`dormduri/observability-config`에 push |
| `deploy` | build 성공 또는 `main`의 dispatch, `production-api` 승인 | `id-token: write`·`attestations: write`, API deploy role(environment secret) | 더 새 변경 확인, provenance 생성(push만)·검증, SBOM 확인, 배포 기록으로 직전 묶음 계산, document 해시 대조, SendCommand, 외부 smoke, 실패 시 rollback 또는 API 내림                                                                                                             |
| `tag`    | deploy 성공, 동작이 `maintenance`가 아님                 | `id-token: write`, API publish role                                          | 배포한 묶음에 `deploy-<UTC YYYYMMDD>T<HHmm>-<run>` image tag를 더한다(ECR lifecycle의 최근 배포 보존)                                                                                                                                                                           |
| `record` | deploy 성공(tag 결과와 상관없이)                         | `contents: write`                                                            | 단계 기록을 만들어 공개 기록 scanner로 검사한 뒤 run 요약과 Release `deploy-api-<UTC YYYYMMDD>-<run>` 본문에 쓴다                                                                                                                                                               |

- Workflow 최상위 권한은 `contents: read`이고 write는 위 job에만 있다(`scripts/ci/contracts/github-workflow-trust.test.mjs`).
  Workflow 글의 신뢰 경계는 `scripts/infra/user-host/api-cd-contract.test.mjs`가 고정한다.
- API role은 Web role과 나뉜다. Publish role은 세 API repository만 push·retag하고, deploy role은 environment `production-api`에서만
  `dormduri-api-deploy` document를 배포 대상 tag의 node에 보낸다. 어느 role도 secret을 읽지 않는다(정책 원본
  [`infra/aws/iam/`](../../aws/iam/)).
- API 배포 입력 경로(trigger의 `paths`)는 API Dockerfile이 복사하는 경로(`apps/api/**`, `packages/database/**`,
  `packages/shared/**`, `packages/tsconfig/**`, `packages/eslint-config/package.json`, root lockfile·workspace 파일,
  `infra/deploy/api/**`, `infra/db/**`), `.dockerignore`, 관측 설정 image가 복사하는 운영 관측 설정(`infra/observability/Dockerfile`
  `COPY` 원본, local compose·예시·README는 빠짐), API 묶음 조각·document 원본(`infra/deploy/user/api/**`), 두 document가 같이 담는
  `infra/deploy/user/ssm/lib.sh`와 이 workflow다. 공유 package·lockfile·`.dockerignore`·`lib.sh`를 바꾼 merge는
  `web-cd`와 `api-cd`를 함께 시작한다.
- Run log와 run 요약은 7일 뒤 지워진다. 남길 것(멈춘 실행의 멈춘 조건·복구 결과, host `RESULT=` 줄, 첫 실행의 공개 기록 검사
  결과)은 7일 안에 그 단계 이슈 댓글로 옮긴다. 단계 기록은 Release 본문이라 보존 기간과 상관없다.

## Host가 하는 일

`deploy`는 lock → Web 기록 확인 → secret 꺼내기·설치(0400 파일) → migrate image one-off `migrate`·`grant`·`smoke`·`outbox` → 옛
API 정지 → 새 API 시작 → readiness(`/health/ready`) → host 안 smoke(ingress private listener를 거친 공개 열람 응답,
`/internal/metrics` 닫힘) → `current` 갱신 → 관측 단계(설정 image 펼치기, 관측 secret 파일 쓰기, upstream 관측 image 받기,
관측 다섯 다시 만들기)다. 관측 단계의 network 호출은 step 상한(900초)보다 60초 이른 840초 안에 끝나게 끊는다.
결과는 command 출력의 `RESULT=` 줄이고 성공한 `deploy`는 migrate 시작 시각 `migrateStarted=<UTC>`를 함께 쓴다. 관측 단계는
fail-open이라 그 실패가 exit code와 `RESULT`를 바꾸지 않는다. 대신 성공한 `deploy`·`rollback`의 `RESULT` 줄에 있는 `observability=ok|failed`가 관측 결과다
([운영 관측 runbook](../operations/observability/production-stack.md#배포rollback과-fail-open)). `maintenance`는 관측 stack을
건드리지 않는다.

| 결과                                                                                                                    | 뜻                                                                                            | host 상태                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| exit 0 `RESULT=succeeded`                                                                                               | 끝까지 통과                                                                                   | `deploy`: 새 묶음이 `current`, 이전 묶음이 `previous`. `rollback`: 직전 묶음이 `current`, `previous`는 비움. `maintenance`: API를 내림 |
| exit 2 `RESULT=failed reason=web-record-legacy`·`web-maintenance`·`web-record`                                          | Web 기록이 옛 형식이거나 Web이 점검 mode이거나 Web 기록을 읽지 못해 secret을 꺼내기 전에 멈춤 | 바뀌지 않음                                                                                                                            |
| exit 2 `RESULT=rejected`(입력), `reason=no-previous`·`previous-mismatch`·`no-current`·`api-record`(상태)                | 입력이나 host 기록 상태가 맞지 않아 거부                                                      | 바뀌지 않음                                                                                                                            |
| exit 75 `RESULT=locked`                                                                                                 | 다른 배포(Web 포함)가 host lock을 잡음                                                        | 바뀌지 않음                                                                                                                            |
| exit 1 `reason=migrate`·`grant`·`smoke`·`outbox`·`secret-fetch`·`secret-invalid`·`migration-secret`·`pull`·`api-record` | rollout 전 실패                                                                               | 이전 API가 계속 돈다. migrate 실패면 부분 적용을 가정한다                                                                              |
| exit 1 `reason=rolled-back-to-current`(`deploy`)                                                                        | 새 API가 readiness·host 안 smoke에서 실패                                                     | 지금 묶음을 다시 띄움                                                                                                                  |
| exit 1 `reason=rollback-failed-kept-current`(`rollback`)                                                                | 직전 묶음이 readiness·host 안 smoke에서 실패                                                  | 지금 묶음을 다시 띄움. 기록은 그대로                                                                                                   |
| exit 1 `reason=entered-maintenance`                                                                                     | 새 묶음(또는 rollback 대상)이 실패했고 지금 묶음이 없거나 다시 띄우지 못함                    | API를 내림(공개 경로는 Web fallback)                                                                                                   |
| `RESULT` 줄 없음(command `TimedOut`·`Cancelled` 등)                                                                     | document가 step 상한 안에 끝나지 못하고 끊김                                                  | 알 수 없음. [실패 대응](#실패-대응)의 결과 줄 없는 command                                                                             |

## 첫 실행 전 Owner 확인

1. ECR repository `dormduri/api`·`dormduri/api-migrate`·`dormduri/observability-config`가 있다(tag immutability, scan on push,
   [`infra/aws/ecr/lifecycle-policy.json`](../../aws/ecr/lifecycle-policy.json)). Lifecycle preview로 `deploy-` image와 그 index의
   하위 manifest가 만료 대상이 아님을 본다. 결과만 기록하고 식별자는 적지 않는다.
2. API publish·deploy role이 [`api-publish-role.*`](../../aws/iam/api-publish-role.permissions.json)·
   [`api-deploy-role.*`](../../aws/iam/api-deploy-role.permissions.json) template과 같다(trust `sub`은 publish가
   `ref:refs/heads/main`, deploy가 `environment:production-api`이고 둘 다 `api-cd.yml`). Host role의 ECR pull 정책이 다섯
   repository를 담고([`host-role.ecr-pull.json`](../../aws/iam/host-role.ecr-pull.json)), secret 읽기 정책이
   [`host-role.secrets-read.json`](../../aws/iam/host-role.secrets-read.json)과 같다.
3. GitHub: environment `production-api`(required reviewer Owner, deployment branch `main`만, admin bypass off), 그 environment
   secret `AWS_API_DEPLOY_ROLE_ARN`, repository secret `AWS_API_PUBLISH_ROLE_ARN`
   ([원격 저장소 설정](../../../docs/development/github/remote-repository-settings.md)). Environment는 `api-cd.yml`이 든 `main`
   승격보다 먼저 만든다. 없는 environment를 job이 참조하면 GitHub가 보호 규칙 없이 만든다([Manage environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments))(그때도 environment secret이 없어
   deploy job은 AWS 인증에서 멈춘다).
4. AWS document `dormduri-api-deploy`가 `main`의 `infra/deploy/user/api/ssm/dormduri-api-deploy.json`과 같고,
   `dormduri-web-deploy`가 `main`의 `infra/deploy/user/ssm/dormduri-web-deploy.json`과 같다. 다르면 deploy job의 해시 대조가
   멈춘다. 고칠 때는 그 파일 내용으로 새 버전을 만들고 기본 버전으로 둔다(Systems Manager > Documents). `lib.sh`를 바꾼 PR은 두
   생성본을 함께 바꾸므로 두 document를 함께 갱신한다.
5. Web 묶음이 새 형식 document로 배포돼 있다(Web `current` 기록에 형식 표지가 있음). 아니면 API `deploy`·`rollback`이 exit 2로
   멈춘다. 아래 [대기 실행](#대기-실행)의 Web 먼저 규칙을 따른다.
6. Secrets Manager의 API 묶음 둘과 DB role bootstrap이 저장소 기준과 같다([Secrets Manager checklist](../../aws/secrets-manager-checklist.md),
   [DB operator scripts](../../db/README.md#release-order)). Bootstrap SQL이 바뀌었으면 master로 다시 실행하고 권한 내역
   이슈에 댓글을 남긴 뒤 master 비밀번호를 바꾼다.

## 배포

1. API 배포 입력을 바꾼 PR이 `main`에 들어가면 `build`가 돌고 `deploy`가 `production-api` 승인을 기다린다.
2. 첫 실행은 build job log를 연다. Account ID(role unique ID 앞부분 포함)와 registry host가 `***`로 가려졌고 workflow
   artifact가 없음을 본 뒤 승인한다.
3. 승인하면 deploy job이 차례로 확인한다. 하나라도 실패하면 host에 아무것도 보내지 않는다.
   - 승인을 기다리는 동안 `main`의 API 배포 입력이 바뀌었는가(이 실행 commit과 `main` 끝의 API 배포 입력 경로 tree 비교)
   - 세 digest의 attestation이 이 workflow·`refs/heads/main`·이 실행 commit에서 왔는가(`gh attestation verify`)
   - 세 image index에 SPDX SBOM attestation manifest가 있는가
   - document 해시가 저장소 생성본과 같은가
4. SendCommand는 command 단위 상태만 기다린다(node별 결과는 조회하지 않는다). Host가 위 [Host가 하는 일](#host가-하는-일)을
   끝까지 통과하면 Success다.
5. 밖에서 외부 smoke(`scripts/infra/user-host/external-smoke.mjs --mode=serving`)를 돌린다. 공개 API 주소가 없으므로 공개 경로는
   API가 있든 없든 같다: `/`·`/privacy`·`/terms` 200, `/api/**`(`/api/health` 포함) JSON '준비 중' 503.
6. 성공하면 tag·record job이 deploy image tag와 Release를 남긴다. Release의 `components`는 `미판정`으로 시작한다. Operator가
   evidence를 본 뒤 Release 본문을 고친다. `deploy` 기록의 DB migration 줄에는 host `RESULT=` 줄의 `migrateStarted`(UTC)를
   옮겨 적는다(데이터가 망가졌을 때의 PITR 기준 시각). `rollback`·`maintenance` 기록의 DB 항목은 `해당 없음(이 실행은 DB를
바꾸지 않음)`이다. 증거가 빠진 component는 `PASS`로 적지 않는다.
7. 첫 실행 뒤에는 Web 단계 배포의 [배포](./web-stage-deploy.md#배포) 7과 같이 run log·Release·attestation을 내려받아 공개 기록
   scanner로 검사하고 workflow artifact가 0개인지 본다.

## 대기 실행

- `api-cd`와 `web-cd`는 concurrency group `user-host-production` 하나를 workflow 단위로 같이 쓴다. 실행 중인 run은 하나이고
  대기 자리도 하나다. 새 run이 오면 GitHub가 대기 중인 run을 취소하고 새 run이 그 자리를 잡는다. 그래서 한 서비스의 대기 run이
  다른 서비스의 새 run에 취소될 수 있다. 대기 중에 취소된 run은 build 전이라 push한 image가 없으므로, 앞 run이 끝난 뒤 그 run을
  Re-run all jobs로 다시 돌린다.
- GitHub [workflow syntax의 `concurrency`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)는
  group 안 run을 들어온 순서(FIFO)로 처리하지만 실제 시작 시각이 달라 순서는 보장하지 않는다고 적는다. 승인을 기다리는 run도
  끝나지 않은 run이라 group을 잡고 있다고 본다(그 문서와
  [Control deployments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)가
  승인 대기를 직접 말하지 않아 "group 안 실행은 하나" 규칙에서 낸 판단이다. 첫 실행에서 관찰로 확인한다).
- Web 먼저: 한 merge가 `web-cd`와 `api-cd`를 함께 시작했고 API 배포가 새 Web 묶음(ingress private listener)에 기대면 Web을
  먼저 끝낸다. `api-cd`가 먼저 group을 잡아 승인을 기다리면 그 승인을 거절(Reject)한다. 거절한 run은 실패로 끝나고 group이
  풀려 `web-cd`가 돈다. `web-cd` 완료와 Landing smoke를 본 뒤 거절한 `api-cd` run을 Re-run failed jobs로 다시 돌린다. 이
  재실행은 build를 다시 돌지 않고(같은 commit의 두 번째 push는 tag immutability로 거부된다) build job 출력 digest로 deploy부터
  다시 한다. 잘못 승인해도 Web 기록이 옛 형식이면 host가 exit 2로 멈추고 아무것도 바꾸지 않는다.
- Rollback·`maintenance` dispatch가 급하면 승인 대기 중인 run(Web 포함)을 먼저 거절한다. 그렇지 않으면 dispatch가 그 뒤에서
  기다리고, 그 사이 새 push run이 오면 대기 중인 dispatch가 취소된다([Web 단계 배포의 대기 실행](./web-stage-deploy.md#대기-실행)과
  같은 규칙).
- 승인 대기 중인 run보다 더 새 API 배포 입력 run이 있으면 옛 run을 거절한다. 잘못 승인해도 deploy job의 "더 새 변경" 확인이
  host에 보내기 전에 멈춘다. Web 배포 입력만 바뀐 새 run은 옛 API run을 낡게 만들지 않는다.
- Job이나 run을 취소했으면 다음 run 전에 Systems Manager > Run Command > Command history에서 마지막 command가 끝났는지
  본다. 취소해도 host의 command는 끝까지 돌 수 있고, 그동안 다음 command(Web 포함)는 host lock으로 exit 75가 된다.

## 재배포, rollback, API 내림

Actions > API CD > Run workflow에서 branch `main`을 고르고 `action`과 digest 묶음(`api_digest`·`api_migrate_digest`·
`observability_config_digest`)을 넣는다. 묶음은 `deploy-api-*` Release 단계 기록의 `images`나 `previous_safe`에서 복사한다.
Dispatch는 build와 attestation 생성을 하지 않고, 세 digest의 attestation source commit이 같고 그 commit의 API 배포 기록 묶음이
입력과 같을 때만 진행한다(대조 범위는
`deploy-api-*` Release의 최근 100개. Web Release는 세지 않는다).

| `action`      | 넣는 묶음                                                          | 결과                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rollback`    | 가장 최근 `deploy-api-*` deploy·rollback Release의 `previous_safe` | migrate 단계 없이 그 묶음으로 되돌린다. secret은 지금 값을 다시 꺼내 새 release로 설치한다. host와 기록 모두 직전 묶음을 비운다                                                                                                                                                                                                                    |
| `deploy`      | 기록이 있는 아무 묶음                                              | 그 묶음을 다시 올린다. migrate one-off도 다시 돈다(적용할 migration이 없으면 그대로 통과). 지금 묶음과 다르면 지금 묶음이 새 `previous_safe`가 된다. 그 묶음 뒤에 schema를 바꾼 migration이 있으면 옛 grant 표가 새 relation·column을 덮지 못해 `grant`에서 멈춘다(한 transaction이라 권한은 그대로, 이전 API가 계속 돈다). 그때는 forward-fix한다 |
| `maintenance` | 기록이 있는 묶음(보통 지금 묶음)                                   | API container를 내린다. Ingress private listener는 JSON 503이고 `/privacy`·`/terms`는 Web fallback을 낸다. 끝내려면 지금 묶음을 `deploy`로 다시 올린다                                                                                                                                                                                             |

Web이 점검 mode인 동안 `maintenance`를 보내면 host는 API를 내리지만, 외부 smoke(serving)가 Web 점검 화면(503)에서 실패해 run이
실패로 끝나고 단계 기록이 남지 않는다. 그때는 host `RESULT=succeeded action=maintenance` 줄을 단계 이슈 댓글로 옮기고, Web 점검을
끝낸 뒤 지금 묶음을 `deploy`로 다시 올린다.

DB migration은 되돌리지 않는다(forward-fix). 옛 API image가 새 schema에서 깨지면 rollback 대신 고친 migration이나 코드로 다시
배포한다. 데이터가 망가졌을 때만 기록한 `migrateStarted` 시각으로 PITR한다([Backup and restore drill runbook](../operations/database/backup-restore.md)).
Host는 `rollback` 입력이 host의 직전 묶음과 같을 때만 받는다. CD가 외부 smoke 실패로 자동 되돌린 뒤처럼 기록과 host가 어긋나면
host가 exit 2로 거부하고 아무것도 바꾸지 않는다. 그때는 원하는 Release의 `images` 묶음을 `deploy`로 올린다.

## 실패 대응

- build의 image secret scan이 멈추면 아무것도 push하지 않았다. log의 종류·image 안 경로·줄 번호(값은 쓰지 않음)로 출처를 본다.
  진짜 값이면 rotate하고 build 입력에서 뺀다. 실행에 쓰지 않는 파일이면 Dockerfile에서 뺀다. 외부 package의 예시 값이면
  `scripts/infra/user-host/image-secret-scan.mjs`의 허용 목록에 종류와 package 이름을 함께 좁혀 이유와 함께 더하는 PR을 낸다.
- 멈춘 run은 run 요약의 "API CD stopped" 절에 단계별 결과를 남긴다. 단계 기록(Release)은 만들지 않는다. Host가 바뀐 run(자동
  되돌림·API 내림 포함)은 그 절과 host `RESULT=` 줄을 7일 안에 단계 이슈 댓글로 옮긴다.
- migrate 실패(`reason=migrate`): rollout하지 않아 이전 API가 계속 돈다. migration이 일부만 적용됐다고 가정하고, 다음 배포 전에
  `_prisma_migrations`와 schema 상태를 읽어 forward-fix migration을 정한다([DB operator scripts](../../db/README.md#release-order)
  실패 처리). 그 읽기 결과(실패한 migration 이름과 처분, 값이나 연결 문자열은 적지 않음)를 단계 이슈 댓글에 남기고, 고친 배포의
  Release DB migration 줄에도 적는다.
- grant·smoke·outbox 실패: rollout하지 않는다. grant는 한 transaction이라 실패하면 권한이 바뀌지 않는다. outbox 실패는 auth mail
  outbox에 행이 있다는 뜻이다(이 단계는 메일 발신이 없어 행이 없어야 한다). 원인을 고친 뒤 같은 묶음을 `deploy`로 다시 보낸다.
- `web-record-legacy`·`web-maintenance`(exit 2): Web을 새 document로 다시 배포하거나 Web 점검 mode를 끝낸 뒤 API를 다시 배포한다.
- secret 꺼내기·형식 실패(`secret-fetch`·`secret-invalid`·`migration-secret`): Owner가 console에서 host role 정책과 묶음 key를
  [Secrets Manager checklist](../../aws/secrets-manager-checklist.md)와 대조한다. 값은 기록하지 않는다.
- 외부 smoke 실패: deploy job이 기록의 직전 묶음으로 `rollback`을 보낸다. 직전 묶음이 없거나 host가 그 rollback을 받지 않으면
  `maintenance`로 API를 내린다(공개 경로는 Web fallback). 결과는 run 요약의 `recovered:` 줄이다.
- Host는 바뀌었는데 `tag`나 `record` job이 실패했거나 `record`가 403으로 실패했으면 Web 단계 배포의
  [실패 대응](./web-stage-deploy.md#실패-대응)과 같이 Re-run failed jobs, 그다음 실행 종류별 재전송으로 기록과 host를 맞춘다.
- 결과 줄 없이 끝난 command(`TimedOut`·`Cancelled` 등): CD는 외부 smoke·자동 되돌림·단계 기록을 건너뛴다. 관측 단계는 상한 안에서
  끊기므로 그 앞(secret 꺼내기, image 받기, migrate, rollout)에서 끊긴 경우다. Owner가 Session Manager로 host의
  `/opt/dormduri/state/api/current`와 실행 중인 `api` container의 image digest를 읽고(digest만 기록), 외부 smoke를 직접 확인한 뒤
  원하는 Release의 `images` 묶음을 `deploy`로 다시 올려 기록과 host를 맞춘다. migrate 중이었으면 위 migrate 실패처럼
  `_prisma_migrations`를 읽는다.
- Provenance·SBOM·기록 대조·document 해시에서 멈추면 host는 바뀌지 않았다. 다른 workflow나 로컬에서 만든 image, 기록이 없는
  묶음, document 갱신 누락이 흔한 원인이다.

## Break-glass

- Host 접근은 Session Manager가 기본이다. CD가 동작하지 않으면 Owner가 Systems Manager > Run Command에서 document
  `dormduri-api-deploy`를 배포 대상 tag로 직접 보낼 수 있다. 묶음은 Release 기록에 있는 것만 쓴다. 이 실행은 Release를 남기지
  않으므로, 끝나면 이슈 댓글에 동작과 묶음을 적고 CD가 돌아오면 지금 묶음을 `deploy`로 다시 올려 기록과 host를 맞춘다.
- DB에 사람이 직접 접속해야 하면 [DB operator scripts](../../db/README.md#권한-내역과-break-glass)의 기록 규칙을 따른다.
