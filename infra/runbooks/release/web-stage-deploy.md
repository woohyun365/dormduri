# Web 단계 배포

Web 단계(ingress와 Web만 올린 단계)의 배포·재배포·rollback·점검 mode 절차다. 실행은 GitHub Actions workflow
[`web-cd.yml`](../../../.github/workflows/web-cd.yml)이 하고, host에서 할 일은 SSM Command document `dormduri-web-deploy`
([User host 묶음](../../deploy/README.md#user-host-묶음))가 정한다. 지금 운영 구성은
[Production environment](../../../docs/deploy/production-environment.md)가, 단계 기록 형식은
[단계 배포 기록](./production-release-evidence.md#단계-배포-기록)이 소유한다.

공개 저장소라 log·run 요약·Release·이슈·노트에 AWS account ID(registry host·ARN 포함), IP, node·instance ID, email을 쓰지
않는다([식별자 규칙](../../../docs/deploy/README.md#식별자-규칙)). 그런 값이 필요한 자리는 "Owner console"로 적는다. Host와
외부 smoke 출력은 IP를 찍지 않으므로 `curl -v`나 DNS 조회 결과를 붙이지 않는다.

## Workflow 구성

| Job      | 실행 조건                                            | 권한·principal                                                           | 하는 일                                                                                                                                                            |
| -------- | ---------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `build`  | `main` push에서 Web 배포 입력 경로가 바뀜            | `id-token: write`, publish role(repository secret)                       | Web·ingress image를 SBOM과 함께 OCI layout으로 build, image filesystem secret scan, digest 그대로 ECR에 `sha-<commit>` tag로 push                                  |
| `deploy` | build 성공 또는 `main`의 dispatch, `production` 승인 | `id-token: write`·`attestations: write`, deploy role(environment secret) | 더 새 변경 확인, provenance 생성(push만)·검증, SBOM 확인, 배포 기록으로 직전 쌍 계산, document 해시 대조, SendCommand, 외부 smoke, 실패 시 rollback 또는 점검 mode |
| `tag`    | deploy 성공, 동작이 `maintenance`가 아님             | `id-token: write`, publish role                                          | 배포한 쌍에 `deploy-<UTC YYYYMMDD>T<HHmm>-<run>` image tag를 더한다(ECR lifecycle의 최근 배포 보존)                                                                |
| `record` | deploy 성공(tag 결과와 상관없이)                     | `contents: write`                                                        | 단계 기록을 만들어 공개 기록 scanner로 검사한 뒤 run 요약과 Release `deploy-web-<UTC YYYYMMDD>-<run>`(source commit에 tag) 본문에 쓴다                             |

- Workflow 최상위 권한은 `contents: read`이고 write는 위 job에만 있다(`scripts/ci/contracts/github-workflow-trust.test.mjs`).
  Workflow 글의 신뢰 경계는 `scripts/infra/user-host/web-cd-contract.test.mjs`가 고정한다.
- 모든 실행은 concurrency group `web-cd-production` 하나에 줄 선다(`cancel-in-progress: false`). 아래
  [대기 실행](#대기-실행)을 따른다.
- Web 배포 입력 경로(trigger의 `paths`)는 두 Dockerfile이 복사하는 경로, `.dockerignore`, `infra/deploy/web/**`,
  `infra/deploy/user/**`와 이 workflow다. 그 밖의 merge는 build하지 않는다.
- Image를 만드는 BuildKit과 SBOM scanner도 workflow `env`의 `BUILDKIT_IMAGE`·`SBOM_SCANNER_IMAGE`에 tag와 digest로 고정하고,
  Renovate custom regex manager가 갱신한다([image inventory](../../image-inventory.json)).
- `web-tls-check.yml`이 매일 공개 인증서의 남은 기간과 apex·`www` 포함을 본다(아래 [경보 대응](#경보-대응)).
- Run log와 run 요약은 저장소 설정의 보존 기간(7일) 뒤 지워진다. 남길 것(멈춘 실행의 멈춘 조건·복구 결과, 첫 실행의 공개 기록
  검사 결과)은 7일 안에 그 단계 이슈 댓글로 옮긴다. 단계 기록은 Release 본문이라 보존 기간과 상관없다.

## 첫 실행 전 Owner 확인

1. AWS document `dormduri-web-deploy`가 `main`의 `infra/deploy/user/ssm/dormduri-web-deploy.json`과 같다. 다르면 deploy job의
   해시 대조가 멈춘다. 고칠 때는 그 파일 내용으로 새 버전을 만들고 기본 버전으로 둔다(Systems Manager > Documents). 배포 입력
   PR이 `deploy.sh`나 `compose.yml`을 바꾸면 그 PR이 생성본도 바꾸므로, 그 PR의 실행을 승인하기 전에 document를 먼저 갱신한다.
2. Deploy role 권한이 [`infra/aws/iam/deploy-role.permissions.json`](../../aws/iam/deploy-role.permissions.json)과 같다(provenance
   검증과 SBOM 확인이 두 repository의 manifest를 읽는다). Publish role도 그 template과 같다.
3. GitHub: environment `production`(required reviewer Owner, deployment branch `main`만), environment secret
   `AWS_DEPLOY_ROLE_ARN`, repository secret `AWS_PUBLISH_ROLE_ARN`. Landing 방문 통계를 켜려면 repository secret
   `CLOUDFLARE_WEB_ANALYTICS_TOKEN`을 넣는다(없으면 build는 성공하고 script가 없다. 다음 Web build부터 반영된다).
4. ECR lifecycle preview로 `deploy-` image와 그 index의 하위 manifest(platform image·SBOM attestation)가 만료 대상이 아님을
   본다(Amazon ECR > Repositories > Lifecycle policy > preview). 결과만 기록하고 식별자는 적지 않는다.

## 배포

1. Web 배포 입력을 바꾼 PR이 `main`에 들어가면 `build`가 돌고 `deploy`가 `production` 승인을 기다린다.
2. 첫 실행은 build job log를 연다. Account ID와 registry host가 `***`로 가려졌고 workflow artifact가 없음을 본 뒤 승인한다.
3. 승인하면 deploy job이 차례로 확인한다. 하나라도 실패하면 host에 아무것도 보내지 않는다.
   - 승인을 기다리는 동안 `main`의 배포 입력이 바뀌었는가(이 실행 commit과 `main` 끝의 배포 입력 경로 tree를 비교한다.
     `main`은 merge commit으로만 받으므로 history가 아니라 tree를 본다. 바뀌었으면 더 새 실행을 승인한다)
   - 두 digest의 attestation이 이 workflow·`refs/heads/main`·이 실행 commit에서 왔는가(`gh attestation verify`)
   - 두 image index에 SPDX SBOM attestation manifest가 있는가
   - document 해시가 저장소 생성본과 같은가
4. SendCommand는 command 단위 상태만 기다린다(node별 결과는 조회하지 않는다). Host가 health와 내부 smoke(`/`·`/privacy`·
   `/terms` 200, `/signup` 준비 중 503, 없는 경로 404)를 통과하면 Success다.
5. 밖에서 같은 경로표로 외부 smoke(`scripts/infra/user-host/external-smoke.mjs`)를 돌린다. 인증서도 검증한다.
6. 성공하면 tag·record job이 deploy image tag와 Release를 남긴다. Release의 `components`는 `미판정`으로 시작한다. Operator가
   evidence(이 run, ECR attestation manifest, 경보 확인)를 본 뒤 Release 본문을 고친다. 증거가 빠진 component는 `PASS`로 적지
   않는다.
7. 첫 실행 뒤에는 그 run log·run 요약·Release·attestation을 내려받아 `node scripts/infra/user-host/public-record-scan.mjs <파일>`
   로 검사하고(exit 0이어야 한다) 그 실행의 workflow artifact가 0개인지 본다. Run log는 7일 뒤 지워지므로 그 안에 한다. 내려받은
   파일은 `.artifacts/` 아래에 두고 Git에 넣지 않으며, 검사 결과(exit와 건수)만 단계 이슈 댓글에 적는다.

## 대기 실행

- 실행 중인 배포가 끝나기 전에 시작한 실행은 대기(`pending`)한다. 대기 실행이 이미 있으면 GitHub가 그것을 취소하고 새 실행이
  자리를 잡는다. 승인을 기다리는 실행도 group을 잡고 있다.
- 승인 대기 중인 실행보다 더 새 실행이 있으면 옛 실행을 거절(Reject)한다. 잘못 승인해도 deploy job의 "더 새 변경" 확인이
  host에 보내기 전에 멈춘다.
- Rollback dispatch가 급하면 승인 대기 중인 실행을 먼저 거절한다. 그렇지 않으면 dispatch가 그 뒤에서 기다린다.
- Job이나 실행을 취소했으면 다음 실행 전에 Systems Manager > Run Command > Command history에서 마지막 command가 끝났는지
  본다. 취소해도 host의 command는 끝까지 돌 수 있고, 그동안 다음 command는 host lock으로 exit 75가 된다.

## 재배포, rollback, 점검 mode

Actions > Web CD > Run workflow에서 branch `main`을 고르고 `action`과 digest 쌍을 넣는다. 쌍은 Release 단계 기록의 `images`나
`previous_safe`에서 복사한다. Dispatch는 build와 attestation 생성을 하지 않고, 두 digest의 attestation source commit이 같고 그
commit의 배포 기록 쌍이 입력과 같을 때만 진행한다. 그래서 기록이 없는 쌍(로컬 build, 섞은 쌍)은 SendCommand 전에 거부된다.

| `action`      | 넣는 쌍                                             | 결과                                                                                                                    |
| ------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `rollback`    | 가장 최근 deploy·rollback Release의 `previous_safe` | 그 쌍으로 되돌린다. host와 기록 모두 직전 쌍을 비우므로 그보다 이전으로 가려면 그 Release의 쌍을 `deploy`로 다시 올린다 |
| `deploy`      | 기록이 있는 아무 쌍                                 | 그 쌍을 다시 올린다. 지금 쌍과 다르면 지금 쌍이 새 `previous_safe`가 된다. 점검 mode도 끝난다                           |
| `maintenance` | 기록이 있는 쌍(보통 지금 쌍)                        | 모든 공개 경로가 '점검 중' 503이 되고 Web을 내린다(그 쌍의 ingress만 쓴다). 끝내려면 지금 쌍을 `deploy`로 다시 올린다   |

Host는 `rollback` 입력이 host의 직전 쌍과 같을 때만 받는다. 기록의 `previous_safe`와 host의 직전 쌍은 멈춘 실행 뒤에 어긋날 수
있다. 예를 들어 CD가 외부 smoke 실패로 자동 되돌린 뒤에는 host가 직전 쌍을 비웠지만 그 실행은 Release를 남기지 않는다. 그때
`rollback`은 host가 exit 2로 거부하고 아무것도 바꾸지 않는다. 원하는 Release의 `images` 쌍을 `deploy`로 올린다.

## 실패 대응

- 멈춘 실행은 run 요약의 "Web CD stopped" 절에 단계별 결과를 남긴다. 단계 기록(Release)은 만들지 않는다. Run 요약은 7일 뒤
  지워지므로 host가 바뀐 실행(자동 되돌림·점검 mode 포함)은 그 절과 host `RESULT=` 줄을 7일 안에 단계 이슈 댓글로 옮긴다.
- Host command가 Success가 아니면 host가 스스로 직전 쌍으로 되돌렸거나(첫 배포는 점검 mode) 입력을 거부했다. 결과는
  Systems Manager > Run Command > Command history의 그 command 출력 `RESULT=` 줄이다(exit 2 입력 거부, exit 75 다른 실행이
  host lock을 잡음, 그 밖은 자동 복귀 결과). Host log는 Session Manager로 root 전용 log를 본다.
- 외부 smoke가 실패하면 deploy job이 기록의 직전 쌍으로 `rollback`을 보낸다. 직전 쌍이 없거나 host가 그 rollback을 받지
  않으면(기록과 host 상태가 어긋남, 직전 쌍 기동 실패) `maintenance`를 보내 실패한 쌍을 계속 내보내지 않는다. 결과는 run 요약의
  `recovered:` 줄이다. Maintenance까지 실패했으면 아래 [Break-glass](#break-glass)로 간다.
- Host는 바뀌었는데 `tag`나 `record` job이 실패했으면 그 실행의 Re-run failed jobs로 다시 돌린다. 두 job은 이미 붙인 tag와 이미
  만든 Release를 건너뛴다. 다시 실패하면 기록이 host보다 늦은 상태다. 다음 push 배포의 자동 되돌림은 위처럼 점검 mode로
  떨어질 수 있으므로, 원인을 고친 뒤 가장 최근 Release의 `images` 쌍을 `deploy`로 올려 기록과 host를 맞춘다.
- 첫 배포가 실패하면 host는 점검 mode로 멈춘다. 원인을 고친 PR을 다시 `main`에 넣는다.
- Provenance·SBOM·기록 대조·document 해시에서 멈추면 host는 바뀌지 않았다. 다른 workflow나 로컬에서 만든 image, 기록이 없는
  쌍, document 갱신 누락이 흔한 원인이다.

## 경보 대응

- `web-tls-check` 실패(남은 기간 21일 미만, apex·`www` 누락): Session Manager로 host에 들어가 certbot 갱신 timer와 마지막 갱신
  log를 본다. 갱신 뒤 deploy hook이 ingress를 reload한다. 공개 저장소의 예약 workflow는 60일 동안 저장소 활동이 없으면 꺼지므로
  Actions에서 꺼졌는지도 본다.
- 외부 가용성 alarm(Route 53 health check → `us-east-1` CloudWatch alarm → SNS email): 로컬에서
  `node scripts/infra/user-host/external-smoke.mjs --mode=serving`으로 경로별 응답을 본다. '일시적 오류' 503이면 Web이 응답하지
  않는 것이므로 Session Manager로 container 상태를 보고, 고칠 수 없으면 `rollback`이나 `maintenance`를 dispatch한다.

## Break-glass

- Host 접근은 Session Manager가 기본이다. SSH는 Owner가 Lightsail browser SSH 허용 규칙을 잠시 켠 뒤 끝나면 지운다(22는 평소
  닫힘).
- CD가 동작하지 않으면 Owner가 Systems Manager > Run Command에서 document `dormduri-web-deploy`를 배포 대상 tag로 직접 보낼 수
  있다. 쌍은 Release 기록에 있는 것만 쓴다. 이 실행은 Release를 남기지 않으므로, 끝나면 이슈 댓글에 동작과 쌍을 적고 CD가
  돌아오면 지금 쌍을 `deploy`로 다시 올려 기록과 host 상태를 맞춘다.
- Host에서 손으로 container나 `/opt/dormduri/state`를 바꿨으면 같은 방법으로 기록과 맞춘다.
