# 백오피스 단계 배포

백오피스 단계(백오피스 host에 admin ingress·`backoffice-web`·`backoffice-api`·Alloy 묶음을 올리는 단계)의 배포·재배포·rollback·
내림, 운영자 접속, 첫 owner 등록 code, 경보 대응, 비상 절차다. 실행은 GitHub Actions workflow
[`backoffice-cd.yml`](../../../.github/workflows/backoffice-cd.yml)이 하고, host에서 할 일은 SSM Command document
`dormduri-backoffice-deploy`와 `dormduri-backoffice-bootstrap-owner`([백오피스 host 묶음](../../deploy/README.md#백오피스-host-묶음))가
정한다. 신뢰 구조(승인 뒤 배포 전용 job, OIDC 단기 role, provenance, mask, 단계 기록)는 [API 단계 배포](./api-stage-deploy.md)와
같고, 이 문서는 다른 점과 백오피스 고유 절차를 적는다. 단계 기록 형식은
[단계 배포 기록](./production-release-evidence.md#단계-배포-기록)이, 백오피스 규칙은
[운영자 접근 정책](../../../docs/policies/operator-access.md)이 소유한다.

공개 저장소라 log·run 요약·Release·이슈·노트에 AWS account ID(registry host·ARN·role unique ID 포함), IP, node·instance ID,
email, secret 값, 등록 code, DB 연결 문자열을 쓰지 않는다([식별자 규칙](../../../docs/deploy/README.md#식별자-규칙)). 이
workflow는 Secrets Manager와 운영 DB에 닿지 않는다(build job의 PostgreSQL service는 Prisma 생성에만 쓰는 일회용 DB다). 백오피스
API는 migration을 실행하지 않는다. 운영 DB schema는 `api-cd`만 바꾼다.

## Workflow 구성

| Job      | 실행 조건                                      | 권한·principal                                                                    | 하는 일                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | ---------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`  | `main` push에서 백오피스 배포 입력 경로가 바뀜 | `id-token: write`, 백오피스 publish role(repository secret)                       | API CD와 같은 격리 container에서 Prisma client·TypedSQL 생성, `infra/deploy/backoffice-api/Dockerfile`·`infra/deploy/backoffice-web/Dockerfile`의 `runtime` target과 admin ingress(`infra/deploy/backoffice/ingress/Dockerfile`)를 SBOM과 함께 OCI layout으로 build, image filesystem secret scan, digest 그대로 ECR `dormduri/backoffice-api`·`dormduri/backoffice-web`·`dormduri/backoffice-ingress`에 push |
| `schema` | push만, build 성공                             | `actions: read`                                                                   | schema gate: `api-cd`가 마지막으로 host 배포에 성공한 push commit의 `packages/database/prisma`가 이 commit과 같을 때만 지난다. 다르면 이 commit의 `api-cd` push 실행이 배포에 성공할 때까지 최대 90분 기다리고, 그 실행이 실패·취소되거나 없으면 멈춘다(`scripts/infra/backoffice-host/schema-gate.mjs`)                                                                                                      |
| `deploy` | build·schema 성공 또는 `main`의 dispatch, 승인 | `id-token: write`·`attestations: write`, 백오피스 deploy role(environment secret) | environment `production-backoffice` 승인 뒤 더 새 변경 확인, provenance 생성(push만)·검증, SBOM 확인, 배포 기록으로 직전 묶음 계산, document 해시 대조, SendCommand. 외부 smoke는 없다(공개 주소 없음). host 안 smoke 결과가 command Success에 든다                                                                                                                                                           |
| `tag`    | deploy 성공, 동작이 `maintenance`가 아님       | `id-token: write`, 백오피스 publish role                                          | 배포한 묶음에 `deploy-<UTC YYYYMMDD>T<HHmm>-<run>` image tag를 더한다                                                                                                                                                                                                                                                                                                                                         |
| `record` | deploy 성공(tag 결과와 상관없이)               | `contents: write`                                                                 | 단계 기록(`stage: backoffice`, smoke 칸은 `host smoke (backoffice): SSM command Success`)을 공개 기록 scanner로 검사한 뒤 run 요약과 Release `deploy-backoffice-<UTC YYYYMMDD>-<run>` 본문에 쓴다                                                                                                                                                                                                             |

- Workflow 최상위 권한은 `contents: read`이고 write는 위 job에만 있다(`scripts/ci/contracts/github-workflow-trust.test.mjs`).
  Workflow 글의 신뢰 경계는 `scripts/infra/backoffice-host/backoffice-cd-contract.test.mjs`가 고정한다.
- 백오피스 role은 user host role과 나뉜다. Publish role은 세 백오피스 repository만 push·retag하고, deploy role은 environment
  `production-backoffice`에서만 `dormduri-backoffice-deploy` document를 배포 대상 tag `dormduri-deploy-target=backoffice-app`의
  node에 보낸다. 첫 owner 등록 code document는 어느 CD role도 보내지 못한다(Owner 관리 권한만). 정책 원본은
  [`infra/aws/iam/backoffice-*`](../../aws/iam/)이고 `scripts/infra/aws/policy-templates.test.mjs`가 고정한다.
- 배포 입력 경로(trigger의 `paths`)는 두 Dockerfile이 복사하는 경로(`apps/backoffice-*/**`, `packages/{database,shared,tsconfig,
eslint-config}/**`, root manifest·lockfile, `.dockerignore`, `infra/deploy/api/rds-ca-bundle.sha256`), `infra/deploy/backoffice*/**`,
  deploy document가 담는 `infra/deploy/user/api/ssm/secret_bundle.py`, 이 workflow다. Concurrency group은 `backoffice-host-production`
  이라 user host 배포(`user-host-production`)와 서로 기다리지 않는다.

## Host가 하는 일

Document 원본은 [`infra/deploy/backoffice/ssm/deploy.sh`](../../deploy/backoffice/ssm/deploy.sh)다. 순서와 멈춤:

1. 입력 검사(action·digest 셋, exit 2)와 host lock(`/opt/dormduri/state/lock`, 다른 실행이 잡았으면 exit 75). 첫 owner 등록 code
   document도 같은 lock을 쓴다.
2. [Docker Engine 하한](#docker-engine-하한) 확인. 하한 밖이면 image를 받기 전에 exit 2로 멈춘다.
3. 세 image를 digest로 받고 Secrets Manager `/dormduri/production/backoffice`를 꺼내 key 여섯을 UID 10001 소유 0400
   release(디렉터리 0500)로, Alloy가 읽는 셋(metrics token, 수신 주소·token)을 root 소유 0400 사본으로 설치한다. API container는
   그 가운데 네 파일만 파일 단위로 mount한다. 여기까지 실패하면 지금 묶음은 그대로 돈다.
4. 새 release 디렉터리(compose·Alloy 설정·기록)로 세 service를 `up --wait`한 뒤 host 안 smoke를 본다: Host `localhost:4300`의
   `/login` 200, 다른 Host(`127.0.0.1:4300`) 421, 다른 Origin의 BFF 상태 변경 403과 고정 origin header의 통과, API metrics가 token이
   있을 때만 열림, 묶음이 host에 publish한 것이 `127.0.0.1:4300` 하나뿐.
5. 실패하면 직전 묶음으로 다시 띄우고(`reason=rolled-back-to-current`), 직전이 없으면 세 service를 내린 채 둔다
   (`reason=entered-maintenance`, 운영자 접속 닫힘). 성공하면 기록(`current`·`previous`)을 바꾸고 Alloy를 다시 띄운다(fail-open,
   실패는 RESULT 줄 `observability=failed`로만 남는다).

실제 동작은 `scripts/infra/backoffice-host/ssm-document-runtime.mjs`가 일회용 container에서 가짜 docker·aws·curl로 28가지 경로를
돌려 판정하고(`pnpm infra:check` runtime gate), admin ingress의 Host·header 경계는 `scripts/infra/backoffice-host/ingress-smoke.mjs`가
실제 nginx로 본다.

## Docker Engine 하한

Admin ingress는 host `127.0.0.1:4300`에만 publish한다. Lightsail 방화벽은 같은 계정의 사설 IP traffic을 거르지 않으므로(F7),
같은 network의 다른 host가 loopback publish port로 직접 route하는 길은 Docker가 막아야 한다.

- Docker Engine 28.0.0 release note: "Fix a security issue that was allowing neighbor hosts to connect to ports mapped on a loopback
  address." 그리고 port publishing 문서: "In releases older than 28.0.0, hosts within the same L2 segment (for example, hosts connected
  to the same network switch) can reach ports published to localhost." 그래서 하한은 Docker Engine 28이다.
- 그 보호는 iptables `raw` table 규칙이다. 끄는 설정이 셋 있다: daemon option `"allow-direct-routing": true`, 환경 변수
  `DOCKER_INSECURE_NO_IPTABLES_RAW`(28.0.2 release note: "When enabled, Docker will not create rules in the iptables `raw` table."),
  `iptables: false`. nftables backend는 29.0.0에서 실험 기능이다("Experimental support for nftables can now be enabled by setting
  Docker daemon's `firewall-backend` option to `nftables`.").
- Document는 Engine major가 28 미만, firewall backend가 `iptables`가 아님, 설정 파일(dockerd 명령줄의 `--config-file`, 없으면
  `/etc/docker/daemon.json`)의 `allow-direct-routing: true`·`iptables: false`·`ip6tables: false`, dockerd 명령줄의
  `--allow-direct-routing`·`--iptables=false`·`--ip6tables=false`, dockerd 환경의 `DOCKER_INSECURE_NO_IPTABLES_RAW` 가운데 하나라도
  있으면 아무것도 바꾸기 전에 멈춘다(`reason=docker-engine-below-28`·`docker-firewall-backend`·`docker-daemon-config`). Compose 계약 test는 bridge network에
  보호를 끄는 driver option(`gateway_mode`·`trusted_host_interfaces` 등)이 없음을 고정한다.
- Document가 배포마다 하한을 보므로 host의 지금 판은 따로 적지 않는다. Engine을 올릴 때는 그 판의 release note에 이 보호를
  약하게 하는 항목이 없는지 본다(29.x release note에는 없다, 2026-11-22 확인).

## 첫 실행 전 Owner 확인

1. ECR repository `dormduri/backoffice-api`·`dormduri/backoffice-web`·`dormduri/backoffice-ingress`가 있다(tag immutability, scan on
   push, [`infra/aws/ecr/lifecycle-policy.json`](../../aws/ecr/lifecycle-policy.json)).
2. 백오피스 publish·deploy role이 [`backoffice-publish-role.*`](../../aws/iam/backoffice-publish-role.permissions.json)·
   [`backoffice-deploy-role.*`](../../aws/iam/backoffice-deploy-role.permissions.json)과 같다(trust `sub`은 publish가
   `ref:refs/heads/main`, deploy가 `environment:production-backoffice`이고 둘 다 `backoffice-cd.yml`). 백오피스 host role
   (`dormduri-backoffice-host-ssm`)에 [`backoffice-host-role.ecr-pull.json`](../../aws/iam/backoffice-host-role.ecr-pull.json)과
   [`backoffice-host-role.secrets-read.json`](../../aws/iam/backoffice-host-role.secrets-read.json)을 더했다. 백오피스 host에 tag
   `dormduri-deploy-target=backoffice-app`을 붙였다(`user-app`이 아님).
3. GitHub: environment `production-backoffice`(required reviewer Owner, deployment branch `main`만, admin bypass off), 그 environment
   secret `AWS_BACKOFFICE_DEPLOY_ROLE_ARN`, repository secret `AWS_BACKOFFICE_PUBLISH_ROLE_ARN`
   ([원격 저장소 설정](../../../docs/development/github/remote-repository-settings.md)). Environment는 `backoffice-cd.yml`이 든 `main`
   승격보다 먼저 만든다.
4. AWS document `dormduri-backoffice-deploy`·`dormduri-backoffice-bootstrap-owner`를 `main`의
   `infra/deploy/backoffice/ssm/*.json`으로 만든다. `secret_bundle.py`를 바꾼 PR은 API document와 백오피스 deploy document를 함께
   바꾸므로 둘을 함께 갱신한다.
5. Secrets Manager `/dormduri/production/backoffice`의 key 여섯이 [Secrets Manager checklist](../../aws/secrets-manager-checklist.md)와
   같다. 관측 secret 묶음 `/dormduri/production/observability`에 `BACKOFFICE_HOST_PRIVATE_IP`·`BACKOFFICE_INGEST_TOKEN` 둘을 더했고,
   그 token이 백오피스 묶음의 `OBSERVABILITY_INGEST_TOKEN`과 같다. 둘이 없으면 user host 수신 gateway가 모두 거부한다(백오피스
   경보가 오지 않음).
6. User host에 수신 gateway(`obs-gateway`)가 든 API 묶음이 배포돼 있다(`api-cd`가 먼저). User host Lightsail 방화벽은 9480을 열지
   않는다(백오피스 host가 사설 IP로 닿는다).
7. Bootstrap SQL 재실행으로 `dormduri_backoffice`·`dormduri_backoffice_retention` LOGIN user가 있고 묶음의 두 URL이 그 user와
   `sslmode=verify-full`을 쓴다([DB operator scripts](../../db/README.md)). master 사용은 #883에 댓글로 남긴다.
8. 백오피스 host에 AWS CLI v2가 있다(user host 준비와 같은 snap `aws-cli --classic`, `/usr/local/bin/aws`). Document는 image를
   받기 전에 `aws sts get-caller-identity`로 host role credential을 보므로 CLI가 없으면 `reason=sts`로 멈춘다(host는 그대로).
9. Identity Center에 운영자 permission set이 있고 Owner에게 할당돼 있다. 대상은 배포 대상 tag `dormduri-deploy-target=backoffice-app`
   node뿐이고, 문서는 `AWS-StartPortForwardingSession`(백오피스 화면)과 `AWS-StartPortForwardingSessionToRemoteHost`(사람 DB 조회)
   둘뿐이며, node·RDS endpoint 조회와 자기 session 종료·재개만 더한다. 관리 permission set은
   `AWS-StartPortForwardingSessionToRemoteHost`를 Deny해 사람 DB 조회가 user host를 거치지 않는다. 바꾼 날과 내용(식별자 없이)은
   #883에 댓글로 남긴다.

## 배포

1. 백오피스 배포 입력을 바꾼 PR이 `main`에 들어가면 `build`가 돌고 `schema`가 schema gate를 본다. 같은 승격이 schema를 바꿨으면
   `api-cd` 배포를 먼저 승인한다. gate가 지나면 `deploy`가 `production-backoffice` 승인을 기다린다.
2. 첫 실행은 build job log를 연다. Account ID와 registry host가 `***`로 가려졌고 workflow artifact가 없음을 본 뒤 승인한다.
3. 승인하면 deploy job이 더 새 변경, attestation, SBOM, 배포 기록, document 해시를 차례로 본다. 하나라도 실패하면 host에
   아무것도 보내지 않는다.
4. SendCommand는 command 단위 상태만 기다린다. Host가 [Host가 하는 일](#host가-하는-일)을 끝까지 통과하면 Success다.
5. 성공하면 tag·record job이 image tag와 Release를 남긴다. Release의 `components`는 `미판정`으로 시작한다. Operator가 host RESULT 줄의
   `observability` 값과 Grafana의 백오피스 log·지표(`service=~"backoffice-.*"`)를 본 뒤 고친다.

## 운영자 접속

- 접속은 SSM 포트 포워딩 하나다: Owner 노트북 `localhost:4300` → 백오피스 host `127.0.0.1:4300` → admin ingress → Web → API.
  운영자 permission set(첫 실행 전 확인 9)의 단기 credential로
  `aws ssm start-session --target <node> --document-name AWS-StartPortForwardingSession --parameters '{"portNumber":["4300"],"localPortNumber":["4300"]}'`
  (대상 node는 console에서 고르고 기록하지 않는다). 사람 DB 조회도 같은 permission set으로 백오피스 host를 거친다
  ([백업·복구](../operations/database/backup-restore.md#실행-경로)).
- 주소창은 `http://localhost:4300`만 쓴다. WebAuthn RP ID가 `localhost`이고 BFF가 Origin·Host를 port까지 정확히 대조하므로 다른
  이름·port(`127.0.0.1:4300`, 다른 local port)는 421이거나 상태 변경이 403이다.
- 백오피스 전용 browser profile을 쓰고(확장 프로그램 없음) 그 profile에서는 다른 사이트와 다른 port의 `localhost` 앱을 열지 않는다.
  Cookie는 port를 가리지 않아 같은 profile의 `localhost` 개발 서버에도 백오피스 session cookie가 간다. 끝나면 로그아웃하고
  session을 닫는다.
- Passkey는 기기를 잃어도 남는 곳(OS 계정에 동기화되는 저장소)에 두거나 내 보안 설정에서 둘 이상 등록한다. 한 browser profile에만
  둔 passkey는 그 profile을 지우면 사라지고, 그때는 복구 로그인으로 새 passkey만 등록할 수 있다.
- 로그인 화면은 잘못된 비밀번호·잠긴 계정·없는 계정에 같은 문구를 낸다. 잠금은 `BackofficeAccountLocked`와 감사 기록의 `거부`
  줄로 알고 15분 기다린다. 역할을 회수하면 대상 계정의 session이 모두 끝난다(자기 역할 회수면 지금 session도 끝나 다시 로그인한다).

## 첫 owner 등록 code

1. 활성 계정이 없을 때만 Owner가 자기 관리 권한으로 Systems Manager > Run Command에서 `dormduri-backoffice-bootstrap-owner`를
   백오피스 host에 보낸다(email·표시 이름 parameter). 15분 일회용 code는 그 command의 표준 출력(SSM 결과)에만 나온다. host log와
   docker log에는 남지 않는다(one-off의 log driver none, Alloy 수집 밖).
2. 바로 포트 포워딩으로 접속해 code로 등록하고 passkey·TOTP를 등록한다. 복구 code와 TOTP 비밀 사본은 오프라인(종이·암호화된
   오프라인 저장소)에만 두고 이 저장소·이슈·노트에 쓰지 않는다. `BACKOFFICE_TOTP_ENCRYPTION_KEY`의 Owner 오프라인 사본도 같다.
3. 비밀번호·passkey 단계를 마쳐 계정이 생기면 `BackofficeBootstrapOwnerUsed` critical 경보가 온다(정상, 그 뒤 TOTP 확인과 복구 code
   저장이 이어진다). 경보 시각과 등록 시각이 맞는지 본다.
4. 첫 초대 전 선행(Owner 2026-11-22 Q4): 앱 밖에서 owner 역할을 회수하는 절차(유일한 owner가 기기·TOTP·복구 code를 모두 잃었거나
   계정이 탈취됐을 때)를 정하기 전에는 다른 운영자를 초대하지 않는다. 그 절차가 생기기 전의 break-glass는 아래
   [Break-glass](#break-glass)의 master 경계뿐이다.

## 대기 실행

- `backoffice-cd`는 concurrency group `backoffice-host-production`을 쓴다. 실행 중인 run과 대기 자리가 하나씩이고, 새 run이 오면
  대기 중인 run이 취소된다(API 단계 배포의 [대기 실행](./api-stage-deploy.md#대기-실행)과 같은 규칙).
- schema gate가 기다리는 동안에도 run은 group을 잡는다. Gate는 60초마다 `api-cd` 실행을 보고(끝난 실행의 job 결과는 다시 묻지
  않음), 읽지 못하면 다시 시도한다. 같은 승격의 `api-cd` 승인이 늦으면 gate가 90분 뒤 멈추고, `api-cd` 배포 뒤 그 run을 Re-run
  failed jobs로 다시 돌린다(build를 다시 돌지 않는다).
- 승인 대기 중인 run보다 더 새 백오피스 배포 입력 run이 있으면 옛 run을 거절한다. 잘못 승인해도 "더 새 변경" 확인이 host에
  보내기 전에 멈춘다.

## 재배포, rollback, 백오피스 내림

Actions > Backoffice CD > Run workflow에서 branch `main`을 고르고 `action`과 digest 셋을 넣는다. 묶음은 `deploy-backoffice-*`
Release 단계 기록의 `images`나 `previous_safe`에서 복사한다. Dispatch는 build·schema gate·attestation 생성을 하지 않고, 세 digest의
attestation source commit이 같고 그 commit의 백오피스 배포 기록 묶음이 입력과 같을 때만 진행한다.

| `action`      | 넣는 묶음                                                                 | 결과                                                                                                                         |
| ------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `rollback`    | 가장 최근 `deploy-backoffice-*` deploy·rollback Release의 `previous_safe` | 그 묶음으로 되돌린다. secret은 지금 값을 다시 꺼내 새 release로 설치하고 compose·Alloy 설정은 그 묶음의 release 것을 쓴다    |
| `deploy`      | 기록이 있는 아무 묶음                                                     | 그 묶음을 다시 올린다. 지금 묶음과 다르면 지금 묶음이 새 `previous_safe`가 된다                                              |
| `maintenance` | 기록이 있는 묶음(보통 지금 묶음)                                          | 세 service를 내린다(운영자 접속 닫힘). Alloy는 남아 `BackofficeNotReady`가 온다. 끝내려면 지금 묶음을 `deploy`로 다시 올린다 |

DB migration은 되돌리지 않는다. 옛 백오피스 image가 새 schema와 맞지 않으면 rollback 대신 고친 코드로 다시 배포한다.

## 실패 대응

- 멈춘 run은 run 요약의 "Backoffice CD stopped" 절에 단계별 결과를 남긴다. Host가 바뀐 run(자동 되돌림·내림 포함)은 그 절과
  host `RESULT=` 줄을 7일 안에 단계 이슈 댓글로 옮긴다.
- `docker-engine-below-28`·`docker-firewall-backend`·`docker-daemon-config`(exit 2): host는 그대로다. Docker 설정을
  [Docker Engine 하한](#docker-engine-하한) 안으로 되돌린 뒤 다시 보낸다. 보호를 끄는 설정을 두고 배포하지 않는다. `docker info`가
  firewall backend를 알리지 않는 판도 `docker-firewall-backend`로 멈추므로 그때는 Engine을 올린다.
- `sts`: image를 받기 전에 host role credential 확인(`aws sts get-caller-identity`)이 실패했다. Host는 그대로다. AWS CLI(첫 실행 전
  확인 8)와 SSM agent가 쓰는 credential 파일(`/root/.aws/credentials`)을 Run Command로 읽어(값은 출력하지 않음) 고친 뒤 그 run을
  Re-run failed jobs로 다시 돌린다(승인을 다시 받는다).
- `secret-fetch`·`secret-invalid`: Owner가 host role 정책과 묶음 key를 checklist와 대조한다. 값은 기록하지 않는다.
- `rolled-back-to-current`·`entered-maintenance`: host 안 smoke나 readiness가 실패했다. Owner가 Session Manager로 host log
  (`/opt/dormduri/state/deploy-backoffice.log`, `SMOKE` 줄)를 읽고 원인을 고친 묶음을 다시 배포한다.
- 결과 줄 없이 끝난 command(`TimedOut`·`Cancelled`): Owner가 host의 `/opt/dormduri/state/current`와 실행 중인 container의 image
  digest를 읽고(digest만 기록) 원하는 Release의 `images` 묶음을 `deploy`로 다시 올려 기록과 host를 맞춘다.
- schema gate 멈춤: 같은 commit의 `api-cd` 실행이 없거나 실패했거나 90분 안에 배포하지 못했다. API 단계를 먼저 고쳐 배포한 뒤
  다시 돌린다.

## 경보 대응

경보는 백오피스 host Alloy → user host 수신 gateway(`obs-gateway`, 백오피스 host 사설 /32와 token만 받음) → Prometheus·Loki →
Alertmanager → Slack 고정 형식으로 온다(규칙 `infra/observability/prometheus/rules/backoffice-alerts.yml`). 사건 경보
(`increase(…[10m]) > 0`)의 울림은 사건 뒤 약 1분 안에 오고, 해제는 사건 10분 뒤 판정된 다음 Alertmanager의 5분 간격 차례에 와서
10~15분 뒤다. 10분 안에 같은 사건이 또 나면 새 울림 없이 이어진다. `@channel`은 critical 울림에만 붙어 warning은 알림 없이 온다.

| 경보                                                             | 등급             | 대응                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BackofficeRecoveryLogin`                                        | critical         | 복구 로그인(TOTP 또는 복구 code)이 본인인지 Owner가 감사 기록의 그 시각 `로그인`과 CloudTrail `StartSession`으로 바로 확인한다. 아니면 `maintenance`로 내려 운영자 접속을 닫고 감사 기록의 `passkey 등록` 줄을 본다. 앱 안에는 비밀번호 변경이 없으므로 자격 증명은 [Break-glass](#break-glass)의 master 경계로 바꾼다                                               |
| `BackofficeBootstrapOwnerUsed`                                   | critical         | 첫 owner 등록이 계획된 것인지 본다. 아니면 백오피스를 `maintenance`로 내리고 감사 행을 읽는다                                                                                                                                                                                                                                                                        |
| `BackofficeAuditWriteFailed`                                     | critical         | 감사 쓰기 실패는 그 작업도 되돌린다. DB 연결·권한을 보고 고칠 때까지 권한 변경을 멈춘다                                                                                                                                                                                                                                                                              |
| `BackofficeAccountLocked`                                        | warning          | 로그인 실패가 본인 것인지 감사 기록(`로그인` `실패` 다섯, `계정 잠금`, 잠긴 동안의 `거부`)과 그 시각의 CloudTrail `StartSession`으로 확인한다. 본인이면 15분 뒤 다시 로그인한다. 아니면 비밀번호를 아는 사람이 운영자 터널까지 들어온 것이므로 `maintenance`로 내리고 운영자 permission set 할당을 본다. 앱 안에는 비밀번호 변경이 없다([Break-glass](#break-glass)) |
| `BackofficeRoleChanged`·`BackofficeSelfApproval`                 | warning          | 감사 화면에서 그 변경과 승인 사유를 확인한다                                                                                                                                                                                                                                                                                                                         |
| `BackofficePermissionDeniedBurst`                                | warning          | 10분에 5번 이상 권한 밖 기능을 시도했다. 감사 화면과 log에서 그 계정을 보고 의도하지 않았으면 session을 끊는다                                                                                                                                                                                                                                                       |
| `BackofficeNotReady`·`BackofficeApiMetricsDown`                  | critical         | host log와 container 상태를 본다. 배포 직후면 직전 묶음으로 `rollback`한다                                                                                                                                                                                                                                                                                           |
| `BackofficeTelemetryAbsent`                                      | critical         | 백오피스 host·Alloy·user host gateway 가운데 무엇이 멈췄는지 본다(gateway health, 관측 묶음 두 key, 백오피스 host 상태)                                                                                                                                                                                                                                              |
| `BackofficeRetentionFailed`·`BackofficeRetentionStalled`         | warning          | 관리자 기록 정리가 실패하거나 3시간 성공하지 않았다. DB 연결과 `backoffice_retention` 권한을 본다. 다음 실행이 밀린 것을 따라잡는다                                                                                                                                                                                                                                  |
| `BackofficeHostDiskUsageHigh`·`BackofficeHostMemoryAvailableLow` | warning·critical | 백오피스 host image·log 정리, container memory 표([readiness](./components/backoffice/readiness.md))와 대조                                                                                                                                                                                                                                                          |

## 비상 절차

- 백오피스 host는 sshd(`ssh.socket`·`ssh.service`)를 끄고 mask했고 Lightsail 방화벽 규칙이 없다. SSM agent 연결이 끊기면 host 안으로
  들어갈 길이 없다. 그때는 그 host를 고치지 않고 Owner가 console에서 새 host로 바꾼다(식별자는 기록하지 않는다).
  1. 같은 Region·가용 영역에 Lightsail Linux 2 GB(Ubuntu 24.04, dual-stack, 고정 IP·자동 snapshot 없음)를 만든다.
  2. User host와 같은 Docker·AWS CLI v2(snap `aws-cli --classic`, `/usr/local/bin/aws`)·unattended-upgrades 설치를 하고 기본 SSH
     key 등록과 password 인증을 끈다. Docker는 [Docker Engine 하한](#docker-engine-하한) 안이어야 한다.
  3. 한 번만 쓰는 hybrid activation으로 SSM에 host role `dormduri-backoffice-host-ssm`을 등록하고 activation을 지운다. Session
     Manager로 접속되는지 본다.
  4. Lightsail 방화벽 규칙을 모두 지우고(IPv4·IPv6) sshd 둘을 disable·mask한다. SSM이 Online인지 다시 본다.
  5. 새 node에 tag `dormduri-deploy-target=backoffice-app`을 붙이고 옛 node에서 뗀다.
  6. RDS security group의 백오피스 host `/32`를 새 사설 IP로 바꾸고, 관측 secret 묶음의 `BACKOFFICE_HOST_PRIVATE_IP`를 바꿔
     `api-cd`로 지금 API 묶음을 다시 올린다(수신 gateway가 새 주소만 받는다).
  7. 마지막 `deploy-backoffice-*` Release의 `images` 묶음을 `deploy`로 올린다. Secret은 새 host가 다시 꺼내고 운영자 계정은 DB에
     있으므로 다시 등록하지 않는다.
  8. 새 host가 정상이면 옛 host를 지운다(비용).
- 운영자 접속이 급히 막혀야 하면 `maintenance`를 보낸다(Owner가 Run Command로 직접 보내도 된다).

## Break-glass

- CD가 동작하지 않으면 Owner가 Run Command로 `dormduri-backoffice-deploy`를 대상 tag로 직접 보낼 수 있다. 묶음은 Release 기록에
  있는 것만 쓴다. 이 실행은 Release를 남기지 않으므로 이슈 댓글에 동작과 묶음을 적고, CD가 돌아오면 지금 묶음을 `deploy`로 다시
  올린다.
- 앱 밖에서 계정·역할을 바꾸는 유일한 길은 RDS master다. master 사용은 [DB operator scripts](../../db/README.md#권한-내역과-break-glass)의
  기록 규칙을 따르고 #883에 댓글로 남긴다. 유일한 owner가 기기·TOTP·복구 code를 모두 잃으면 master로 그 계정 자격 증명을 지우는
  것 말고는 길이 없다(`bootstrap-owner`는 활성 계정이 있으면 거부한다). 그래서 복구 code를 오프라인에 두는 절차를 먼저 지킨다.
