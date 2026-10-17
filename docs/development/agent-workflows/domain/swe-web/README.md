# Domain/SWE/Web pack

이 디렉터리는 web software 개발의 domain pack입니다. 하위 layer마다 정해야 할 결정 목록, 구현할 때 따르는 지침, 리뷰할 때
판정하는 기준 항목, 전형적인 위험을 한 곳에 둡니다. 지침과 기준은 [review criteria](../../review-criteria/README.md)의 같은
항목을 인용하며 문장을 다시 쓰지 않습니다. 이 pack은 특정 저장소의 경로·명령·stack 이름·정책 값을 쓰지 않고, 그런 값은
binding 키로만 가리킵니다.

## 계층

```text
Domain/<field>/<subdomain>/<layer>/<하위 layer>
이 pack: Domain/SWE/Web/<layer>/<하위 layer>
```

| layer                             | 문서                                          | 하위 layer                                                                                                                       |
| --------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| FE                                | [FE](./fe.md)                                 | `rendering-boundary`, `state-data-cache`, `component-architecture`, `design-system`, `layout-responsive-device`, `accessibility` |
| BFF                               | [BFF](./bff.md)                               | `gateway-forwarding`, `session-cookie-auth`, `server-read-error-privacy-shaping`                                                 |
| security-privacy(cross-cutting)   | [security-privacy](./security-privacy.md)     | `trust-authz-model`, `data-privacy-secret`                                                                                       |
| operations-release(cross-cutting) | [operations-release](./operations-release.md) | `release-gate`, `slo-signal`                                                                                                     |

- BE·DB·infra layer의 하위 layer 절은 그 영역의 기준 문서와 함께 더합니다.
- **상속**: 하위 node는 상위·cross-cutting node의 항목을 `inherits`로 인용합니다. 상속한 항목은 하위 node를 골라도 자기
  기본 severity로 그대로 적용되고, 하위 node가 끄거나 조건을 지우거나 severity를 낮추지 못합니다. 하위 node의 항목은 상속한
  항목보다 좁은 조건을 더 보는 별도 항목이고 기본 severity는 자기 값입니다. 같은 결함이 상속 항목과 하위 항목에 함께
  맞으면 기본 severity가 높은 항목으로 판정합니다. 모든 하위 layer는 SWE 공통 기준을 상속합니다.

## Node 필드

| 필드           | 필수              | 내용                                                                                                   | layer 문서에서의 위치                |
| -------------- | ----------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `id`           | 예                | 계층 경로                                                                                              | 하위 layer 절의 첫 줄                |
| `inherits`     | 예(빈 목록 허용)  | 상위·cross-cutting에서 상속한 기준 항목                                                                | `### 상속`                           |
| `decisions`    | 하위 layer에서 예 | 결정 목록(아래 형식)                                                                                   | `### 결정 목록`                      |
| `guidance`     | 하위 layer에서 예 | 구현 보기. 기준 항목의 지침·피함                                                                       | `### 구현 지침`(항목 인용)           |
| `criteria`     | 하위 layer에서 예 | 리뷰 보기. 기준 항목 id                                                                                | `### 검증 기준`(항목 id)             |
| `risks`        | 하위 layer에서 예 | 전형적 위험과 그 위험을 잡는 기준 항목, 비가역 선택                                                    | `### 위험`                           |
| `bindings`     | 아니오            | 저장소 쪽 값을 가리키는 binding 키                                                                     | `### binding 키`                     |
| `children`     | 아니오            | 하위 node id                                                                                           | layer 문서의 하위 layer 절 목록      |
| `skillOutputs` | 아니오(pack 수준) | skill마다 산출물 하위 디렉터리·파일 이름 목록. 세부 형식과 검사는 pack을 읽는 core scaffold가 정합니다 | 이 pack은 skill이 없어 값이 없습니다 |

- `guidance`와 `criteria`는 같은 기준 항목을 공유합니다. 항목 하나가 구현 보기(지침·피함)와 리뷰 보기(질문·기본 severity·결함
  패턴·PASS 근거)를 함께 가지므로, `구현 지침`은 항목을 링크로 인용하고 `검증 기준`은 같은 항목의 id를 적습니다.
- 기준 항목 참조는 `<문서>.md <ID>` 형식입니다(예: `web-fe-state-data-cache.md F1`). 기준 문서 id는
  `web-<layer>-<하위 layer>`입니다.

## 결정 목록 형식

결정은 `#### <결정 id>` 제목과 아래 필드 줄로 씁니다. 결정 id는 `<layer>.<영역 약칭>.<결정 이름>`입니다. 영역 약칭은 보통 하위 layer
약칭이고, layer 전체 구조를 정하는 결정은 `arch`를 씁니다.

| 필드           | 내용                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| 수준           | 아래 다섯 수준 가운데 하나                                                         |
| 질문           | 쉬운 말 한 문장 질문                                                               |
| 선택지         | 2~4개. 선택지마다 무엇을 하는지와 얻는 것·잃는 것                                  |
| 먼저 정할 결정 | 이 결정보다 먼저 정해야 하는 결정 id. 없으면 `없음`                                |
| 되돌림         | `easy`·`costly`·`one-way`와 되돌릴 때 바뀌는 것                                    |
| 기본값         | 권장 선택지와 쉬운 말 이유, 그 기본값을 버려야 하는 경우                           |
| 확인 단서      | 이미 정해졌는지 저장소에서 판별하는 단서. 저장소 경로·이름은 binding 키로만 씁니다 |
| 기준 항목      | 결정 뒤 구현과 리뷰가 쓰는 기준 항목                                               |

| 수준                 | 뜻                                                        | 고른 결과를 남기는 곳                  | pack이 갖는 것                           |
| -------------------- | --------------------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| `architecture-style` | 시스템 모양(BFF를 둘지, server-rendered와 browser app 등) | 저장소의 architecture 개요와 결정 기록 | 일반 메뉴와 trade-off                    |
| `framework-pattern`  | 고른 framework 안의 관례                                  | 저장소의 layer 관례(binding 문서)      | 일반 메뉴. framework 이름은 binding 키로 |
| `code-pattern`       | code 수준 관례                                            | 저장소의 layer 관례(binding 문서)      | 일반 메뉴                                |
| `policy`             | 제품·보안 정책에 묶이는 선택                              | 저장소의 정책 문서                     | 질문과 위험. 값은 정책이 소유            |
| `operational`        | 운영 값과 검사 운영                                       | 저장소의 정책·운영 문서                | 질문과 확인 단서                         |

- 되돌림이 `one-way`이거나, `costly`이면서 다른 결정이 먼저 정할 결정으로 가리키는 결정은 사람의 확인이 필요한 비가역
  선택입니다. 자동으로 기본값을 채우지 않고, layer 문서의 `### 위험`에 목록으로 둡니다.
- 질문과 선택지 설명은 SWE 경험이 적은 사용자도 읽을 수 있게 씁니다. 전문 용어는 처음 쓸 때 풀어 씁니다.
- 선택지가 결정의 기준 항목이 결함으로 보는 쪽이면 그 선택지 끝에 "연결된 기준 항목 `<기준 문서> <항목>`이 결함으로
  본다"를 적고, 조건이 있으면 그 조건을 앞에 씁니다. 기본값의 버릴 조건은 그런 선택지를 권하지 않고 기준 항목의
  지침·PASS 근거와 어긋나지 않게 씁니다.
- pack은 일반 메뉴와 권장 기본값만 갖습니다. 저장소가 무엇을 골랐는지는 그 저장소의 결정 기록과 binding 문서에 둡니다.

## Binding 참조

```text
{{binding:<kind>.<key>}}
kind = scope | stack | tool | repo-structure | product | command | policy
```

- 값은 pack을 쓰는 저장소의 binding 문서가 key → 값 표로 가집니다. pack 문서와 기준 문서는 값을 쓰지 않습니다.
- key는 영문 소문자·숫자·`-`로 씁니다.
