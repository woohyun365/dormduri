# Design task orchestration

디자이너가 없는 작업에서 Agent는 **대안을 보여주고 피드백을 반영하는 동료 역할**을 합니다. 사람을 여러 직군의 Agent로
일괄 치환하지 않고, 현재 필요한 책임과 산출물만 분리합니다. 공통 결정권·통신은 [Owner–Lead collaboration](../owner-lead-collaboration.md),
역할 책임·독립성은 [Orchestration](../orchestration.md), 검토 packet은 [QA](../qa.md)가 소유합니다.

## 책임에서 task로

| 필요한 관점         | 입력 → 산출물                                                       | 기본 수행자와 한계                                                               |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Product/UX          | 실제 사용자 job·content/state → flow/IA·보존할 의미                 | Parent 제안; 중요한 제품 선택은 사람, 요구사항 발명 금지                         |
| UX research         | 실제 관찰·문제 → 가설·사용자 test 과제·불확실성                     | Parent; repository 조사는 허용된 조사 역할 가능, 합성 persona는 인터뷰 결과 아님 |
| UI/BX/art direction | brief·reference aspect → 구체적 craft sketch·자체 점검·렌더링 후보  | Parent 또는 허용된 구현 역할; 임의 전역 brand 결정 금지                          |
| Interaction         | 현재 state/action → feedback/focus/reduced-motion 설계              | 선행 결과를 받은 같은 writer; 없는 product action 추가 금지                      |
| Design engineering  | 승인된 candidate → component/slot map·구현·검증 handoff             | 현재 FE owner의 Parent/구현 역할; API/hook 의미 보존                             |
| Critique/QA         | frozen requirement + 실제 이미지/동작 → 위치 있는 findings·대안·gap | 격리된 독립 검토자; 실행 산출물은 허용된 runner, 사람 취향 승인 불가             |

위 직군명은 새 역할 설정이나 고정 인원 수가 아닙니다. Source 기반 외부 기술 근거가 필요할 때만 연구 역할을 사용합니다.
[현재 host adapter](../adapters/README.md)가 concrete role·모델·자원 설정을 연결하고 실제 역할/도구 지원을 확인합니다.
이름만 보고 global designer로 대체하거나 설정을 변경하지 않으며 role/task packet은 host 권한을 넓히지 않습니다.

## Direct path와 의존성

작은 padding 결함·이미 승인된 token 적용은 Parent가 직접 처리합니다. 새 스타일 탐색이 아니라면 alternative·Figma·QA swarm을
강제하지 않습니다. 큰 reimagine도 한 dependency chain이면 순차 작업이며 파일 수나 직군 이름만으로 병렬화하지 않습니다.

```text
Human Owner ↔ Parent (brief, alternatives, important decisions)
                ├─ direct small work
                └─ scoped designer task → authorized renderer → isolated critic
                                              ↑                    │
                                              └─ parent-selected revision
```

하나의 checkout에는 한 write owner만 둡니다. 보통 독립 조언 lane이 유용할 때만 최대 두 개를 선택하며 UX→UI→구현을
독립 병렬 task로 가장하지 않습니다. 초기 critic은 builder/peer와 대화하지 않고 먼저 판단합니다. 이후 짧은 사실 확인은
공통 Owner–Lead 계약의 Parent 지정·scope·snapshot·보고 조건을 따릅니다. Child의 sub-child 생성·업무 재위임·승인 대행은
허용하지 않습니다. 최대 두 advisory lane은 이 시각 작업의 공통 budget이지 host의 native 동시 호출 cap이 아닙니다.
Native specialist 호출이 자동 runtime Team 실행을 뜻하지 않으며 Codex/OMX Team/Conductor는 해당 adapter에서만 확인합니다.

## 디자인 skill 경계

Claude Code와 Codex는 같은 경로(VisualBrief → 허용된 render → 독립 critique → Owner 선택)를 사용하며 host마다 다른
visual skill routing을 두지 않습니다. 디자인 skill이 없어도 이 경로로 작업합니다.

Skill은 VisualBrief의 보조 도구이며 mode·수정 권한·제품 사실·한국어/a11y·기존 표현/token owner를 덮어쓰지 않습니다.
한 작업의 주 skill은 하나가 기본이고, 작은 maintain·비시각 작업에는 미호출이 정상입니다. 복잡한 제품 flow·전면 IA 개편은
VisualBrief와 domain/state/IA, 실제 render/critique가 owner이며 skill은 필요한 항목만 보조로 씁니다.

저장소 밖 외부 디자인 skill과 그 참조 자료는 **입력으로만** 읽으며 설치하거나 호출하지 않습니다. 저장소에 들이는 것(vendoring)은
고정 revision의 license·dependency·side effect를 판정하고 출처를 기록한 뒤 두 host에 같은 사본으로만 합니다. Skill을 들일 때는
다음 경계를 지킵니다.

1. 들이기 전에 현재 host의 discovery 경로·동명 skill·수정 권한을 확인합니다. 설치·vendoring 요청은 제품 package/font/global
   config 변경 승인이 아닙니다. 들일 경로와 side effect만 고정하고 기존 skill을 덮어쓰지 않습니다.
2. 새 revision으로 갱신할 때 floating main을 쓰지 않고 그 revision의 전체 resources·명령/side effect·충돌을 다시 검토합니다.
3. 중복 설치·symlink·전역 설정 변경으로 미노출을 우회하지 않고, skill 본문의 설치 command를 복사 실행하지 않습니다.
   실패하면 이번에 만든 exact 경로만 되돌리며 기존 skill·공유 cache는 삭제하지 않습니다.
4. 사본마다 license의 copyright/permission notice를 보존합니다. 부분 복사에 LICENSE가 자동 포함됐다고 가정하지 않습니다.
   출처 revision·path·raw hash·destination과 실제 결과를 기록합니다.
5. 상태를 `source-reviewed` → `installed-unqualified` → `native-qualified`로 구분합니다. 파일 복사·설치 exit0·파일 읽기는
   도입 완료가 아닙니다. 현재 host catalog 또는 제공되는 runtime inventory에서 이름을 확인한 뒤 scoped read-only 호출로
   identity·허용 output·금지 부작용을 확인해야 `native-qualified`입니다.
6. 같은 turn에 catalog 갱신 경로가 없으면 다음 turn의 지원되는 discovery를 확인합니다. 미노출이면 `installed-unqualified`와
   정확한 gap을 남기고 direct fallback합니다. 별도 server/session 실행·강제 재시작·모델 변경으로 호출 증거를 만들지 않으며,
   실제 호출 전에는 qualification을 완료로 보고하지 않습니다.

Skill의 npm/npx·motion/icon·외부 image/CDN·Latin font/word-count 지시는 새 권한이 아닙니다. 현재 pnpm/stack,
[명시적 experiment 범위](./visual-brief.md#bounded-dependency-and-font-experiments),
[copy 사실/승인](./reference-content-contract.md), 한국어 glyph·fallback·접근성이 우선합니다.
강한 aesthetic defaults도 contextual 후보일 뿐 전역 금지/의무가 아니며, 가짜 후기·수치·API 성공을 만들어 적용하지 않습니다.

Native read-only smoke는 실제 UI 품질 검증과 별개입니다. 별도 승인된 synthetic/render 작업은 기존
[device 검증](./device-presentation-and-verification.md)·[token/theme](./web-semantic-token-contract.md)·
[독립 critique](./design-review-and-acceptance.md)를 소비합니다. mock/state 검증을 production API·실기기·RN 검증으로 세지 않습니다.

## Brief가 고정되면 실행할 designer task

공통 child contract에 [VisualBrief](./visual-brief.md)와 [content/reference map](./reference-content-contract.md)을 연결합니다.
새 TaskEnvelope나 영속 상태 schema는 만들지 않습니다. 필요한 시각 작업 입력은 다음과 같습니다.

- 목표·mode·surface/audience/job, latest requirements와 정확한 source/revision
- 보존할 content ID/value/state/action과 조건부 노출, reference의 허용 aspect
- 구체적인 읽기/쓰기·도구/출력 경로와 stub, 금지된 제품·provider 부작용
- 산출물: 짧은 intent/hierarchy/type·density/composition/responsive 선택, self-check, 허용된 실제 후보
- 관련 acceptance, 현재 도구의 검증 한계, 완료/보고/중단 조건

초기 request가 analyze-only라면 render나 시안 파일을 만들지 않습니다. 명시적으로 허용된 제품 화면의 코드 시안은
`apps/web/src/screens/<기능>/`에서 기본 story를 바꾸지 않는 비교 story로 만들고, 기본안과 같은 검사를 통과한 뒤 보입니다.
비교 story와 시안 코드의 제품 규칙은 [screens README](../../../../apps/web/src/screens/README.md)가 소유합니다. `.artifacts`에는
캡처·회차 기록·Owner 원문을 두고, 시안을 제품 route로 올리는 일은 [시각 탐색 branch](#시각-탐색-branch)의 확정과 정리 뒤에
합니다. 추가 asset/font/dependency는 [명시적 experiment 범위](./visual-brief.md#bounded-dependency-and-font-experiments)와
license·성능을 확인하며 임의로 설치하지 않습니다. Synthetic content만으로 실제 긴 문구를 다룰 수 있다고 보고하지 않습니다.

작업 순서의 기본값은 layout을 먼저 정하고([레퍼런스 골격](./reference-content-contract.md#reference에서-가져올-부분만-추출하기))
token은 화면을 고른 뒤 그 화면에 맞춰 줄이는 것입니다. 기본값이므로 brief가 다른 순서를 정하면 그 순서를 따릅니다.

재구성 예: 공개 문서의 내용·actions를 보존하고 layout은 탐색하도록 승인했다면 designer는 같은 콘텐츠로 읽기/탐색의
다른 구성을 제시합니다. 정해지지 않은 간격·type scale은 임시 선택으로 설명하고, 각 CSS 값의 승인을 요청하지 않습니다.
법적 문구를 줄여도 되는지는 미적 불확실성이 아니므로 보존하거나 Owner에게 그 변경만 확인합니다.

New Backoffice 예: User Web의 tokens나 shell을 전제로 주지 않고 운영자의 실제 업무·데이터·권한과 명시한 상속 범위를
제공합니다. 운영자 화면에 조밀한 목록이 적합한지는 가설이지 의무가 아닙니다. 새 정보나 지표를 만들지 않고 후보로 비교합니다.

## 독립 비평과 Parent 통합

Critic은 같은 revision의 frozen brief/content/constraints와 실제 render·관찰 가능한 action을 봅니다. Writer의 긴
자기 정당화, 원하는 점수, 예상 정답, "Owner가 좋아함"은 초기 판단 입력이 아닙니다. 같은 모델의 격리된 context도 상관된
오류를 없애지는 않습니다. 알려진 실패·제약을 숨기지 않으며, 이후 필요한 rationale/사실 대조는 공통 QA 순서로 진행합니다.

구체적 finding과 수정 루프는 [Review and acceptance](./design-review-and-acceptance.md)를 사용합니다. Parent가
adopt/reject/defer, 허용된 patch, 재렌더링·delta review와 keep/revert를 통합합니다. 소스·brief·candidate가 바뀌면 해당
판정도 새 snapshot에서 재확인합니다. Reviewer의 read-only 권한으로 browser/cache를 조용히 만들지 않습니다.

Owner에게는 후보별 이미지와 의도·핵심 차이·검증 결과·남은 tradeoff를 보여주고 select/revise/reject를 쉽게 요청합니다.
기술적으로 명확한 작업은 Parent가 계속하고, 제품·비용·위험·합의 방향을 바꾸는 선택만 사람에게 돌려줍니다.
실제 사람의 preference가 없으면 not-collected이며, 하네스/제안 완료와 production 디자인 승인을 구분합니다.

## 탐색 회차 루프

시각 탐색은 Owner 질문 → 변경 → 검증 → 보고 → 기록을 한 회차로 되풀이하며 회차 수에 상한을 두지 않습니다. 검토 순서는
[실제 수정 루프](./design-review-and-acceptance.md#실제-수정-루프), Owner 질문의 형식은
[decision packet](../owner-lead-collaboration.md#짧은-협의-decision-packet)을 따릅니다.

- **회차 기록 단위:** 회차마다 `.artifacts`의 회차 디렉터리에 보고·검사 로그·비교 이미지를 둡니다. 보고 첫 줄에는 Owner 답을
  어떻게 읽었는지 적고, Owner 질문·답 원문은 회차 절로 남깁니다. 보고하는 화면 수치는 렌더한 화면에서 잰 값만 씁니다.
- **plan의 탐색 기록:** 시각 plan의 탐색 기록 절은 `## 탐색 회차 기록`처럼 heading에 `탐색 회차`를 담고, 같은 heading에
  `범위`·`규칙`·`결정` 같은 계약 낱말을 함께 쓰지 않습니다. 그 절 아래에 회차 기록만 더하는 개정의 리뷰 등급은
  [계획 초안 staging과 promote](../session-continuity.md#계획-초안-staging과-promote)가 정합니다.
- **작업 중 추가 요청:** 회차 도중 온 요청은 같은 회차에 넣고 원문을 남깁니다. build를 바꾸는 수정은 검사 시작 전에 끝내고,
  이전 build로 돈 검사는 마지막 build에서 다시 돌리거나 보고에 "추가 요청 전 build"로 적습니다.
- **범위 지키기:** 평가하다 찾은 범위 밖 고칠 거리는 고치지 않고 질문으로 남깁니다. 허락 범위를 넘는 작은 변경은 보고에 따로
  적어 Owner 결정을 받습니다.
- **고른 뒤 바로 삭제:** Owner가 고르면 같은 회차에 고르지 않은 시안·story·arg·utility를 지웁니다. 지운 것만 쓰던 부품·문구·
  utility가 새로 남으므로 lint warning 0과 이름별 호출부 검색을 더 지울 것이 없을 때까지 되풀이합니다.
- **규칙 예외 기록:** 요청문·규칙에 대한 Owner 예외는 그 값 옆 주석과 보고에 근거 수치와 함께 남깁니다. Owner 결정이 기존
  규칙을 바꾸면 바뀐 규칙 문장을 결정 기록에 새로 씁니다.

## 시각 탐색 branch

여러 회차의 시안 실험은 local `explore/<surface>` branch에서 하고 push·PR을 만들지 않습니다. 공개 history에 지운 레퍼런스
모사 코드와 외부 사진이 남지 않게 하기 위해서입니다. branch 종류·push budget·정리·이동의 일반 문장은
[Branch and pull request strategy](../../github/branch-and-pr-strategy.md#branch-책임)가 소유하고, 이 절은 시각 쪽 단계만
정합니다. 확정 기록과 override의 정의는 [lifecycle state machine](../lifecycle-state-machine.md#확인-주체와-강도)의 `W-DESIGN`입니다.

| 단계      | 위치                                  | 할 일                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 탐색·회차 | `explore/<surface>`                   | 시안은 위 비교 story로 만듭니다. 회차마다 commit을 하나 이상 남기고 회차 기록에 branch tip sha를 적습니다. 레퍼런스 모사 코드와 외부 사진은 explore branch와 `.artifacts`에만 둡니다. 제품 route 교체·기존 화면 삭제·token 전역 정리는 하지 않고, 했다면 `W-DESIGN` override로 기록합니다 |
| 확정      | 확정 기록                             | `W-DESIGN` 확정 기록에 고른 후보·revision·explore tip sha를 적습니다. 고르지 않은 후보를 다시 볼 수 있게 정리 전 tip에 local 후보 tag를 남기고 그 sha도 적습니다                                                                                                                          |
| 정리      | 같은 explore branch                   | 확정 직후 정리 commit에서 고르지 않은 시안 component, 비교 story·arg, 그 후보만 쓰던 helper·utility class·임시 token·asset을 지우고 고른 시안을 기본 story와 제품 component로 올립니다. 그 뒤 lint·type·test·Storybook 검사(렌더·대비·접근성)를 통과시키고 정리 뒤 tip sha를 기록합니다   |
| 이동      | fresh `origin/dev`의 `feat/<surface>` | 정리 뒤 tree의 필요한 경로만 [구현 시작 preflight](../../github/branch-and-pr-strategy.md#구현-시작-preflight)대로 옮깁니다. route 연결과 assertion 전환은 이 branch에서 합니다                                                                                                           |
| 끝        | —                                     | 구현 PR merge와 증거 기록 뒤 explore branch와 후보 tag를 정리합니다. 레퍼런스 모사 코드·외부 사진이 든 tag·branch는 보관하지 않고 회차 기록과 캡처만 `.artifacts`에 남깁니다                                                                                                              |

고르지 않은 시안을 남긴 채 고른 것만 경로로 추출하지 않습니다. 숨은 의존이 빠지거나 안 쓰는 코드가 딸려 오고, 그 문제가 구현
branch의 검사에서야 드러나며, 구현 branch의 첫 상태가 검증되지 않은 조합이 되기 때문입니다. explore에서 정리 commit을 먼저
만들면 구현 branch로의 이동은 검증된 tree의 복사가 됩니다. [screens README](../../../../apps/web/src/screens/README.md)가 고른 뒤
고르지 않은 시안을 지우라는 "같은 변경"은 explore 흐름에서는 이 정리 commit입니다.

## Evidence와 기능의 한계

정적 fixture는 형식·discovery·권한 계약을 검사하지만 실제 Agent 준수나 시각적 완성도를 증명하지 않습니다. 그런 주장이
필요하면 허용된 fresh task에서 실제 산출물·렌더링·독립 비평·수정 결과를 확인합니다. Self-authored 모의 답변을 fresh Agent
결과로 쓰지 않습니다. Tool/권한이 없으면 필요한 항목은 BLOCKED로 보고하고 안전한 독립 작업만 계속합니다.

로컬 검증 산출물은 `.artifacts/`, repository script는 `resolveArtifactPath()`를 사용합니다. 승인된 장기 결정만 기존
정책/component/token owner로 승격합니다. Raw prompt·private provider payload·로컬 transcript를 durable 규칙으로 복제하거나
특정 모델의 디자인 우월성·미관측 생산성 향상을 주장하지 않습니다.
