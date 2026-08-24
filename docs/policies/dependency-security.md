# Dependency security

## 1. 책임

이 문서는 direct/transitive dependency vulnerability의 triage, remediation, exception, dismissal과 release blocker를
소유한다. Dependency update owner와 Dashboard 운영은
[`dependency-automation.md`](../architecture/platform/dependency-automation.md)와
[`dependency-updates.md`](../development/github/dependency-updates.md)를 따른다. 외부 신고 방법은
[`SECURITY.md`](../../.github/SECURITY.md)가 소유한다.

## 2. 기본 원칙

1. Alert 개수나 severity만으로 실제 exploitability를 단정하지 않는다.
2. `transitive`, `runtime`, `development` metadata만으로 dismiss하지 않는다.
3. Owning direct dependency, production artifact 포함 여부, vulnerable function reachability를 함께 확인한다.
4. 해결 순서는 owning parent patch/minor, compatible resolution, bounded override, mitigation 순이다.
5. Override에는 compatibility test, owner 설명, 제거 조건이 있어야 한다.
6. Default branch reconciliation 전에는 GitHub alert closure를 완료 증거로 사용하지 않는다.
7. Raw GitHub/provider output과 exploit detail은 `artifacts/local/security/`에 두며 tracked policy에 복사하지 않는다.

## 3. 분류

| 상태                 | 의미                                                               | 요구 증거                                     |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `shipped-reachable`  | Production artifact에 있고 현재 요청/worker path에서 실행 가능     | artifact + caller/config/test                 |
| `shipped-not-called` | Artifact에는 있으나 현재 기능 caller가 없음                        | artifact + repo-wide caller negative evidence |
| `build-only`         | Build/Storybook/code generation 중에만 사용                        | owner chain + runtime artifact absence        |
| `test-only`          | Test runner/fixture에서만 사용                                     | owner chain + production artifact absence     |
| `cli-only`           | Lint/generator/maintenance CLI에서만 사용                          | command owner + runtime artifact absence      |
| `mixed`              | Patched runtime version과 vulnerable toolchain version이 함께 존재 | version별 owner/artifact evidence             |
| `unknown`            | Evidence가 아직 부족함                                             | release `NO-GO` for high severity             |

## 4. 우선순위

1. Shipped and reachable high severity with an available patch
2. Shipped and reachable medium severity
3. Shipped but currently uncalled high severity
4. Build/test/CLI high severity
5. Medium/low toolchain findings

Security-critical update는 ordinary dependency freeze의 예외다. 같은 package의 routine Renovate PR과 Dependabot security PR을
동시에 merge하지 않는다.

## 5. Remediation과 exception

- Patch가 있으면 owner-local regression과 전체 영향 범위 CI를 통과시킨다.
- Patch가 없으면 parent 제거/update, vulnerable feature 차단, artifact 제외를 순서대로 검토한다.
- Exception은 package/advisory, artifact/reachability, mitigation, owner, review date, expiry/revisit trigger를 포함한다.
- `dismissed`는 fix와 같지 않다. GitHub dismissal에는 동일한 evidence를 남기고 default branch 상태를 다시 확인한다.
- Security exception이 성능 측정 중 dependency를 바꾸면 affected baseline sample을 폐기하거나 명시적으로 재조정한다.

## 6. Release NO-GO

다음 중 하나라도 존재하면 production release를 진행하지 않는다.

- 미분류 high alert
- Patch가 존재하는 shipped/reachable high alert
- Owner 또는 reachability evidence가 없는 runtime alert
- 만료된 exception
- Default branch와 release artifact dependency graph 불일치
- Security reporting channel 부재

## 7. GitHub 설정 경계

- Dependabot vulnerability alerts를 활성 상태로 유지한다.
- Automated security fixes를 활성 상태로 유지하되 생성 PR을 일반 CI/owner 검토 없이 merge하지 않는다.
- Routine npm update는 Renovate, GitHub Actions·Docker·Compose와 security update는 Dependabot이 소유한다.
- Security Policy는 민감한 상세를 public issue에 쓰지 않도록 안내한다.

## 8. 변경 이력

| 날짜       | 변경 내용                                                                      | 관련 이슈                |
| ---------- | ------------------------------------------------------------------------------ | ------------------------ |
| 2026-08-24 | Dependency alert triage, exception, dismissal과 release NO-GO 기준을 추가했다. | GitHub Security baseline |
