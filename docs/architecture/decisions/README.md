# Decision records

제품 설계·계획에서 정한 기술 결정(L2)을 domain pack layer마다 한 파일로 기록합니다. 결정의 판정과 질문은
[Discovery](../../development/agent-workflows/plan-authoring/discovery.md)가 정하고, 질문·선택지는
[Domain/SWE/Web pack](../../development/agent-workflows/domain/swe-web/README.md)을 링크하며 다시 쓰지 않습니다. 이 디렉터리
밖의 기존 architecture 결정 문서는 옮기지 않고 [산출물 추적 대응 기록](../../product/README.md#산출물-추적-대응-기록)으로
연결합니다.

## Layer 파일

- 위치는 `docs/architecture/decisions/<layer>.md`입니다. Pack layer 문서 하나에 파일 하나이고(`fe.md`·`bff.md`·`be.md` 등 pack
  문서와 같은 이름), 그 layer의 첫 기록 때 만듭니다.
- 제목 바로 아래 연속한 굵은 key 줄로 상태 header를 둡니다: `**상태**`(`draft`·`owner-confirmed`·`superseded`),
  `**확인일**`(`owner-confirmed`일 때), `**확인 근거**`(Owner 확인 기록의 위치), `**근거**`(상위 산출물 링크).
- 새 layer 파일을 만드는 변경은 아래 색인과 [architecture README](../README.md) 색인에 그 파일 행을 더합니다.
- 기록과 지금 code가 어긋난 곳은 [누적 이탈 점검](../../development/agent-workflows/review-criteria/README.md#누적-이탈-점검)이 layer 파일 단위로 모읍니다.

## 항목 형식

`## <하위 layer>` 절 아래 결정마다 `#### <결정 id>` 제목과 아래 필드 줄을 둡니다.
`node scripts/agents/common/discovery-questions.mjs --sublayer <하위 layer id> --skeleton`이 항목 골격을 냅니다.

| 필드          | 내용                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- |
| `판정`        | Inspect·Defer·Escalate·Ask·Infer                                                            |
| `상태`        | 아래 상태 어휘 하나                                                                         |
| `고른 선택지` | 고른 값 또는 값 원본 링크(아래 "고른 값의 원본")                                            |
| `근거`        | 영향·불확실성·비가역성·되돌리는 비용                                                        |
| `기각한 대안` | 고르지 않은 선택지와 이유                                                                   |
| `재검토 조건` | 다시 정할 조건                                                                              |
| `출처`        | 작업의 GitHub issue 번호와 Owner 확인 날짜. 리뷰를 PR 전에 받으므로 PR 번호는 쓰지 않습니다 |
| `pack 결정`   | Pack 결정 링크                                                                              |

- 결정 id는 pack 결정 id입니다. Pack에 없는 결정은 `<layer>.<영역 약칭>.<결정 이름>`으로 쓰고 `pack 결정: 없음`을 둡니다.
- 질문·선택지는 pack을 링크하고 다시 쓰지 않습니다.
- 한 layer 파일에서 `#### <결정 id>`는 한 번만 씁니다. 결정을 바꾸면 그 항목의 `고른 선택지`·`근거`를 고치고 `이전 선택`
  줄(날짜·선택·바꾼 이유·출처)을 더합니다. 영역마다 다르게 고르면 제목을 `<결정 id>/<영역 약칭>`으로 씁니다.

### 고른 값의 원본

| Pack 수준                          | `고른 선택지`                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-style`               | 이 기록의 값이 원본입니다                                                                                                                                |
| `framework-pattern`·`code-pattern` | [Repo binding의 고른 값](../../development/agent-workflows/domain/knu-binding.md#고른-값) 절의 행이 원본이고, 이 기록의 `고른 선택지`는 그 행 링크입니다 |
| `policy`·`operational`             | 정책 문서 규칙 id 링크입니다. 값과 정책 Owner 확인은 정책 문서(header와 규칙)가 소유합니다                                                               |

어느 수준이든 판정·상태·근거·기각한 대안·재검토 조건·출처는 이 기록에 둡니다.

## 상태 어휘와 ADR 대응

| 상태          | 뜻                                   | ADR 관례              |
| ------------- | ------------------------------------ | --------------------- |
| `known`       | 저장소에서 이미 정해짐(Inspect)      | —                     |
| `unknown`     | 아직 정하지 않음                     | —                     |
| `deferred`    | 이 작업이 고정하지 않음(재검토 조건) | —                     |
| `provisional` | 권장 기본값으로 둠(재검토 조건)      | proposed              |
| `validated`   | 사용자·Owner가 확인함                | accepted              |
| `superseded`  | 결정 자체가 더는 쓰이지 않음         | deprecated·superseded |

- ADR의 rejected는 상태가 아니라 `기각한 대안`에 기록합니다.
- 파일 header의 상태(`draft`·`owner-confirmed`·`superseded`)는 파일 단위의 다른 축입니다.

## 색인

| Layer 파일              | Pack layer                                                                  | 하위 layer 절                             |
| ----------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| [FE 결정 기록](./fe.md) | [Domain/SWE/Web/FE](../../development/agent-workflows/domain/swe-web/fe.md) | `component-architecture`, `design-system` |
