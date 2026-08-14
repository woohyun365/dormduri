# Lightsail runtime release readiness

## 책임과 상태

이 문서는 Lightsail User App host와 mounted secret runtime의 실제 배포 입력을 소유한다. 현재 실제
instance가 없으므로 `PENDING_TARGET`다.

## Release 입력

| 입력                                  | 현재 값                             |
| ------------------------------------- | ----------------------------------- |
| Lightsail bundle / region / instance  | `PENDING_TARGET`                    |
| Static IP / firewall                  | `PENDING_TARGET`                    |
| Deploy user / SSH key / sudo boundary | `PENDING_TARGET`                    |
| Secret release root                   | `/var/lib/knu-roommate/secrets/api` |
| Container mount root                  | `/run/secrets/knu-roommate-api`     |
| API runtime UID/GID                   | `10001:10001`                       |
| Snapshot / disk headroom / retention  | `PENDING_TARGET`                    |
| Current / previous release retention  | 최소 2개, 실제 값 `PENDING_TARGET`  |

## 준비 절차

1. Secret release root를 `root` 소유 `0750`으로 만들고 runtime GID `10001`만 읽게 한다.
2. Version file은 `root:10001`, `0440`; `current`는 같은 filesystem의 version directory symlink다.
3. Candidate를 설치·검증한 뒤 새 container readiness가 통과한 경우에만 `current`를 전환한다.
4. Previous bundle과 previous safe image digest를 유지하고 rollback을 rehearsal한다.
5. Secrets Manager 원문 bundle과 snapshot의 보존·삭제·접근 owner를 함께 결정한다.
6. Snapshot restore 후에는 Secrets Manager에서 새 bundle을 materialize하고 노출 가능 credential을
   rotation한 뒤에만 traffic을 연다.
7. SSH, Docker, nginx 외 public port를 닫고 observability port를 private network에 둔다.

## 중단 조건

- Secret mount가 writable이거나 image layer에 포함된다.
- Candidate 실패가 현재 정상 release의 pointer 또는 traffic을 변경한다.
- Host snapshot에 포함되는 secret의 접근·삭제·rotation owner가 없다.
- Long-lived AWS access key가 host나 container에 존재한다.
