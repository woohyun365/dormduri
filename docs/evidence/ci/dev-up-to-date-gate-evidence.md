# `dev` up-to-date gate evidence

> **Audience:** 사람 대상 portfolio·onboarding·engineering discussion. 규칙의 owner가 아닙니다. 기대 설정과 현재값은
> [Remote repository settings](../../development/github/remote-repository-settings.md), 결정은
> [Monorepo CI architecture의 Branch protection 적용](../../architecture/platform/monorepo-ci.md#branch-protection-적용)이
> 소유합니다.

`dev-integration-gate` ruleset의 "Require branches to be up to date before merging"(strict)를 켠 결정의 기록입니다
([#713](https://github.com/woohyun365/dormduri/issues/713)). 측정 구간은 첫 `dev`→`main` 승격 PR #737의 merge
(2026-10-29T12:42:09Z)부터 #784의 merge(2026-10-31T15:25:37Z, `dcfa5d9c`)까지 약 2.1일입니다.

## 1. 문제와 관측

- CI workflow는 `pull_request`와 `main` push에서만 돕니다. `dev` merge push에는 CI가 없습니다.
- `dev-integration-gate`는 `CI summary`를 요구했지만 strict가 꺼져 있어, PR head가 최신 `dev`보다 뒤처져도 merge할 수
  있었습니다. 그러면 squash merge가 만드는 `dev` tree(최신 `dev`와 PR 변경의 조합)는 어떤 CI도 검사하지 않은 상태로
  `dev`에 들어갑니다.
- 첫 승격 뒤 Renovate가 security·patch·minor·digest PR을 스스로 merge하면서 `dev`가 자주 움직였습니다(3절).
- 그동안은 사람이 merge 직전에 PR CI가 검사한 `dev`와 지금 `origin/dev`를 비교하는 수동 절차로 막았습니다. GitHub가
  강제하지 않아 그 절차를 모르는 PR이나 실수를 막지 못합니다.

## 2. 측정 방법과 재현 명령

| 신호                  | 방법                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev` 이동            | `gh pr list --repo woohyun365/dormduri --base dev --state merged --search "merged:2026-10-29T12:45:00Z..2026-10-31T15:26:00Z" --limit 100 --json number,author,mergedAt`. Author가 `app/renovate`인 PR은 사람이 merge했어도 bot PR로 셉니다 |
| 사람 PR의 재검사      | 위 목록의 사람 PR마다 `gh run list --workflow ci.yml --event pull_request --branch <head branch> --json headSha`로 CI가 돈 서로 다른 head SHA 수를 셉니다. 다시 받은 횟수는 그 수에서 1을 뺀 값입니다                                       |
| 뒤처진 채 merge한 PR  | merge 직전 수동 절차의 확인 기록(#713 댓글)                                                                                                                                                                                                 |
| 전체 PR CI 한 번 비용 | Historical full PR p50의 분 올림 합 28분([Monorepo CI baseline](./monorepo-ci-baseline.md))                                                                                                                                                 |

## 3. Baseline

KST 날짜별 `dev` 이동:

| 날짜(KST)    | bot PR | 사람 PR |  합 |
| ------------ | -----: | ------: | --: |
| 2026-10-29   |      5 |       0 |   5 |
| 2026-10-30   |     12 |       6 |  18 |
| 2026-10-31   |      4 |       4 |   8 |
| 2026-11-01   |      2 |       1 |   3 |
| 합(약 2.1일) |     23 |      11 |  34 |

사람 PR이 merge 전에 `dev`를 다시 받은 횟수:

| PR   | 다시 받음 | 원인                                                                              |
| ---- | --------: | --------------------------------------------------------------------------------- |
| #749 |         1 | CI 중 bot merge                                                                   |
| #754 |         1 | PR을 연 지 24초 뒤 bot merge로 `pnpm-lock.yaml` 충돌                              |
| #765 |         1 | `dev` merge commit 1개                                                            |
| #780 |         1 | 리뷰 뒤 bot merge로 `pnpm-lock.yaml` 충돌                                         |
| #784 |         2 | CI 시작 35초 뒤와 다음 CI 시작 38초 뒤 bot merge(#751, #782), Update branch 두 번 |

나머지 사람 PR 여섯(#760·#766·#769·#772·#774·#783)은 다시 받지 않았습니다. 사람 PR 11개 가운데 5개가 `dev`를 다시 받아 CI가
6번 더 돌았고, 수동 절차를 지켜 뒤처진 채 merge한 사람 PR은 0개입니다. 첫 승격 전(2026-10-20~29)에는 사람 PR 24개 가운데 1개
(#691)가 뒤처진 채 merge됐습니다.

## 4. 원인

- Strict가 꺼진 required status check는 PR head의 check 결과만 봅니다. Merge 시점의 base와 PR을 합친 tree는 검사 대상이
  아닙니다.
- Renovate 자동 merge는 bot PR이 최신이고 green이면 바로 merge합니다. 사람 PR의 CI 한 번(wall 약 6분) 사이에 bot merge가
  들어올 가능성이 큽니다.
- Merge queue는 개인 계정 소유 저장소에서 쓸 수 없습니다.

## 5. 대안과 기각

| 대안                   | 막는 시점     | 비용                                                                                     | 판정                   |
| ---------------------- | ------------- | ---------------------------------------------------------------------------------------- | ---------------------- |
| `dev` strict           | merge 전      | 뒤처진 PR마다 Update branch와 CI 한 번. 사람 PR은 수동 절차와 같은 수(11개 중 5개, +6번) | 채택(Owner 2026-11-01) |
| `dev` push CI          | merge 뒤 감지 | `dev`가 움직일 때마다 전체 CI(34번 ÷ 2.1일, 하루 약 16번)                                | 기각                   |
| strict와 push CI 둘 다 | merge 전·뒤   | 두 비용의 합                                                                             | 기각(비용)             |
| 수동 절차 유지         | 지킬 때만     | 사람 확인                                                                                | 기각(강제되지 않음)    |
| Merge queue            | merge 전      | —                                                                                        | 쓸 수 없음(개인 계정)  |

Bot PR은 막히지 않습니다. Renovate의 `rebaseWhen=auto`는 자동 merge PR이거나 저장소가 최신 branch를 요구하면 base보다
뒤처진 PR을 rebase합니다. 자동 merge가 아닌 Renovate PR(major 등)은 사람이 Update branch로 맞춥니다. `main-release-gate`는
`dev`→`main` 승격 PR만 받으므로 strict를 켜지 않습니다.

## 6. 적용과 첫 관측

- 적용: Owner가 GitHub console에서 켭니다. 켠 뒤 read-only 조회로 확인합니다(적용 대기).
- 첫 관측: 이 기록을 더한 PR이 strict 아래에서 merge되는 것(적용 대기).
- 아직 관측하지 않은 것: strict 아래 첫 Renovate 자동 merge PR의 merge, 첫 자동 merge가 아닌 Renovate PR의 rebase 동작.

## 7. 한계와 재측정 조건

- 표본은 2.1일과 사람 PR 11개입니다. "하루 약 16번"은 34번을 2.1일로 나눈 어림입니다.
- Strict의 비용은 Update branch로 더해지는 CI입니다. 지금 public 저장소라 표준 runner는 무료이고, private 전환 뒤에는
  전체 PR CI 한 번이 약 28분으로 과금됩니다.
- Mend Renovate App이 ruleset을 읽을 수 있는지는 확인하지 못했습니다. 영향은 자동 merge가 아닌 Renovate PR의 rebase
  시점뿐입니다.
- 재측정: strict를 켠 뒤 사람 PR 20개 또는 2주 가운데 먼저 오는 때에 Update branch 횟수와 추가 CI 횟수를 다시 셉니다. 같은 PR이
  하루에 세 번 넘게 다시 받으면 그때 다시 판단합니다.

## 8. Interview evidence map

| 질문                                      | 근거 절 |
| ----------------------------------------- | ------- |
| 어떤 문제를 어떤 수치로 확인했는가        | §1, §3  |
| 원인을 어떻게 좁혔는가                    | §4      |
| 왜 다른 방법을 쓰지 않았는가              | §5      |
| 적용을 어떻게 확인하는가                  | §2, §6  |
| 측정의 한계와 다시 측정할 조건은 무엇인가 | §7      |
