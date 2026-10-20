# Product documents

제품 요구(PRD) 묶음과 산출물 추적 대응 기록의 위치입니다. 제품·운영 규칙은 [`policies/`](../policies/README.md), 기술
결정은 [`architecture/`](../architecture/README.md)가 소유하고, 이 디렉터리는 기술 결정을 담지 않습니다.

## PRD 묶음

- 필수 문서는 개요 하나입니다. 기능 영역 문서는 그 영역을 구현할 때 씁니다. 같은 요구는 한 문서만 소유하고, 문서가 둘 이상이면
  이 README가 모두 색인합니다(색인 누락은 repository policy test가 잡습니다).
- KNU의 PRD 개요는 `legacy`입니다. 목적과 대상 사용자는 저장소 root `README.md`와 [정책 README](../policies/README.md)의
  문서 구성 표에 있고 이 디렉터리로 소급해 옮기지 않습니다. 다음에 구현하는 제품 영역부터 기능 영역 문서를 씁니다.

## Intent 기록

- 프로젝트 intent는 `docs/product/intent.md`에 둡니다. PRD에 없는 항목인 영역별 invariant·품질 기준만 영역 절로 쓰고, 목적·대상
  사용자·핵심 흐름·비목표·성공 기준은 PRD 문서를 링크합니다. 같은 의미를 두 기록에 쓰지 않습니다.
- 파일 header는 [결정 기록 layer 파일](../architecture/decisions/README.md#layer-파일)과 같은 상태 header입니다. 첫 영역 절을
  쓰는 변경이 파일을 만들고 이 README에 링크합니다. 기술 결정은 결정 기록에 둡니다.

## 산출물 추적 대응 기록

[`artifact-map.json`](./artifact-map.json)은 PRD 개요·정책·L1·L2 산출물이 어느 문서에 대응하는지와 기록 전체의 Owner
확인(`confirmedBy`)을 담습니다. CI `Lifecycle gate`의 `W-POLICY`가 정책 도메인의 owner-confirmed 근거로 읽습니다. 문서에 상태
header가 붙으면 그 문서는 header로 판정하고 이 기록의 항목은 쓰지 않습니다.

| 필드          | 값                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `mapping`     | `doc`(문서 하나), `composite`(여러 문서), `legacy`(소급하지 않음, 충족으로 계산하되 표시), `not-applicable`(Owner 확인이 있어야 충족) |
| `level`       | 정책의 `cross-cutting`(필수), `cross-cutting-recommended`(권장), `domain`                                                             |
| `confirmedBy` | `status`(`draft`·`owner-confirmed`), `date`(Owner가 내용을 확인한 날짜), `basis`(그 변경 작업의 GitHub issue 번호)                    |

- 이 파일을 바꾸는 PR은 변경 등급과 무관하게 `confirmedBy`를 그 PR의 Owner 확인으로 바꾸고 PR 본문 `Lifecycle` 절에
  `Owner 확인: docs/product/artifact-map.json <날짜>` 줄을 둡니다(`L-CONFIRM`, override로 낮출 수 없음). 작성법은
  [GitHub collaboration guide](../development/github/collaboration.md#lifecycle-절)를 따릅니다.
- owner README·L3·test README 항목은 그 항목을 읽는 검사가 생길 때 더합니다.
