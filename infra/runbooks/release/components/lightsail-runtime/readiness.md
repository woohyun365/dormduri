# Lightsail runtime release readiness

## 책임과 상태

이 문서는 Lightsail User App host와 mounted secret runtime의 실제 배포 입력을 소유한다. Web 단계 host는 있고 그 상태는
[Production environment](../../../../../docs/deploy/production-environment.md)가 적는다. API secret runtime 입력은 API
단계 전이라 `PENDING_TARGET`다.

## Release 입력

| 입력                                 | 현재 값                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lightsail bundle / region / instance | `PENDING_TARGET`                                                                                                                                                                                                                                                                                     |
| Static IP / firewall                 | `PENDING_TARGET`                                                                                                                                                                                                                                                                                     |
| 배포·operator 접근                   | SSM hybrid managed node(host role 원본 `infra/aws/iam/host-role.*`). 배포는 SSM Command document `dormduri-web-deploy`(원본 `infra/deploy/user/ssm/`)와 `dormduri-api-deploy`(원본 `infra/deploy/user/api/ssm/`)이고 CD가 보내기 전에 해시를 대조한다, operator는 Session Manager, SSH는 break-glass |
| Secret release root                  | `/opt/dormduri/secrets/api`(root 0700). Release마다 `releases/<release>`, `current`는 그중 하나를 가리키는 symlink                                                                                                                                                                                   |
| Container mount root                 | `/run/secrets/dormduri-api`                                                                                                                                                                                                                                                                          |
| API runtime UID/GID                  | `10001:10001`                                                                                                                                                                                                                                                                                        |
| Snapshot / disk headroom / retention | `PENDING_TARGET`                                                                                                                                                                                                                                                                                     |
| Current / previous release retention | 최소 2개, 실제 값 `PENDING_TARGET`                                                                                                                                                                                                                                                                   |

## 준비 절차

1. Secret root와 release 디렉터리는 API document가 만든다(미리 만들 것 없음). Release 디렉터리는 `0500`, 파일은 `0400`, 소유는
   runtime UID/GID `10001:10001`이고, document가 설치 뒤 이름·mode·크기·symlink·소유를 검사한다
   (`infra/aws/secrets-manager-checklist.md` Host 전달).
2. `current`는 새 API의 readiness와 host 안 smoke가 통과한 뒤에만 바뀐다. Secret release는 current와 직전 성공 release 둘만 남는다.
3. Host `previous`(직전 image digest 묶음: Web은 `web`·`ingress`, API는 `api`·`api-migrate`·`observability-config`)를 유지하고 rollback을 rehearsal한다. Rollback은 secret을 지금 값으로 다시 꺼낸다.
4. Secrets Manager 원문 bundle과 snapshot의 보존·삭제·접근 owner를 함께 결정한다.
5. Snapshot restore 후에는 Secrets Manager에서 새 bundle을 materialize하고 노출 가능 credential을
   rotation한 뒤에만 traffic을 연다.
6. Public port는 ingress의 80·443만 연다. SSH(22)는 닫고 break-glass 때만 잠시 연다. Observability port는 private
   network에 둔다.

## 중단 조건

- Secret mount가 writable이거나 image layer에 포함된다.
- Candidate 실패가 현재 정상 release의 pointer 또는 traffic을 변경한다.
- Host snapshot에 포함되는 secret의 접근·삭제·rotation owner가 없다.
- Long-lived AWS access key가 host나 container에 존재한다.
