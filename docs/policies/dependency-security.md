# Dependency security

## 1. 책임

이 문서는 direct/transitive dependency vulnerability의 triage, remediation, exception, dismissal과 release blocker를
소유한다. Dependency update owner와 Dashboard 운영은
[`dependency-automation.md`](../architecture/platform/dependency-automation.md)와
[`dependency-updates.md`](../development/github/dependency-updates.md)를 따른다. 외부 신고 방법은
[`SECURITY.md`](../../.github/SECURITY.md)가 소유한다.

## 2. 기본 원칙

1. **DS-R1** Alert 개수나 severity만으로 실제 exploitability를 단정하지 않는다.
2. **DS-R2** `transitive`, `runtime`, `development` metadata만으로 dismiss하지 않는다.
3. **DS-R3** Owning direct dependency, production artifact 포함 여부, vulnerable function reachability를 함께 확인한다.
4. **DS-R4** 해결 순서는 owning parent patch/minor, compatible resolution, bounded override, mitigation 순이다.
5. **DS-R5** Override에는 compatibility test, owner 설명, 제거 조건이 있어야 한다.
6. **DS-R6** Default branch reconciliation 전에는 GitHub alert closure를 완료 증거로 사용하지 않는다.
7. **DS-R7** Raw GitHub/provider output과 exploit detail은 `.artifacts/tools/security/`에 두며 tracked policy에 복사하지 않는다.

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

**DS-R8** Alert는 다음 순서로 처리한다.

1. Shipped and reachable high severity with an available patch
2. Shipped and reachable medium severity
3. Shipped but currently uncalled high severity
4. Build/test/CLI high severity
5. Medium/low toolchain findings

**DS-R9** Security-critical update는 ordinary dependency freeze의 예외다. 같은 package의 routine PR과 security PR을 동시에
merge하지 않는다. Renovate 자동 merge는 `dev`에 최신이고 `CI summary`가 통과한 branch만 한 번에 하나씩 merge한다.

## 5. Remediation과 exception

- **DS-R10** Patch가 있으면 owner-local regression과 전체 영향 범위 CI를 통과시킨다.
- **DS-R11** Patch가 없으면 parent 제거/update, vulnerable feature 차단, artifact 제외를 순서대로 검토한다.
- **DS-R12** Exception은 package/advisory, artifact/reachability, mitigation, owner, review date, expiry/revisit trigger를 포함한다.
- **DS-R13** `dismissed`는 fix와 같지 않다. GitHub dismissal에는 동일한 evidence를 남기고 default branch 상태를 다시 확인한다.
- **DS-R14** Security exception이 성능 측정 중 dependency를 바꾸면 affected baseline sample을 폐기하거나 명시적으로 재조정한다.

## 6. Release NO-GO

**DS-R15** 다음 중 하나라도 존재하면 production release를 진행하지 않는다.

- 미분류 high alert
- Patch가 존재하는 shipped/reachable high alert
- Owner 또는 reachability evidence가 없는 runtime alert
- 만료된 exception
- Default branch와 release artifact dependency graph 불일치
- Security reporting channel 부재

## 7. GitHub 설정과 update owner 경계

- **DS-R16** Dependabot vulnerability alerts를 활성 상태로 유지한다. Dependabot은 alert만 맡고 version update와 security
  update PR을 열지 않는다. 저장소 Settings의 Dependabot security updates는 끈다.
- **DS-R17** npm, GitHub Actions, Dockerfile, Docker Compose의 version update와 security update PR은 Renovate 하나가 `dev`를
  대상으로 연다. 기본 branch 설정에 한 ecosystem의 update owner가 없거나 둘인 상태를 만들지 않는다.
- **DS-R18** Security·patch·minor bot PR과 Docker image digest bot PR은 required check `CI summary`가 통과하고 `dev`에 최신인
  branch일 때 Renovate가 `dev`에 squash merge한다. GitHub 자동 merge(Allow auto-merge)는 쓰지 않는다. Major update와 GitHub
  Actions digest update는 사람이 검토하고, major는 Dependency Dashboard 승인 뒤에 PR이 열린다. 취약점을 고치는 version이
  major뿐인 security update PR은 승인 없이 바로 열리지만 자동 merge하지 않는다. `dev` → `main` 승격과 production 배포는
  사람이 한다.
- **DS-R19** 자동 merge를 멈출 때는 merge를 하는 Renovate를 멈춘다(Mend Portal Dependency Updates OFF 또는 GitHub App
  Suspend). 계속 멈출 group은 `renovate.json`에서 그 group의 `automerge`를 끄는 사람 PR로 바꾸고, 이미 merge된 PR은 revert
  PR로 되돌린다.
- **DS-R20** Security Policy는 민감한 상세를 public issue에 쓰지 않도록 안내한다.

## 8. 변경 이력

| 날짜       | 변경 내용                                                                                                                                                                                           | 관련 이슈                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 2026-08-24 | Dependency alert triage, exception, dismissal과 release NO-GO 기준을 추가했다.                                                                                                                      | GitHub Security baseline |
| 2026-10-29 | 규칙 id를 붙이고 모든 ecosystem의 update PR owner를 Renovate 하나로, Dependabot을 alert 전용으로 바꿨다. Security·patch·minor와 Docker digest bot PR은 `CI summary` 통과 뒤 `dev`에 자동 merge한다. | #732                     |
