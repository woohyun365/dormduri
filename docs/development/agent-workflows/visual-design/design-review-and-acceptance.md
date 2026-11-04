# Visual review and acceptance

이 문서는 **관찰한 화면을 함께 다듬는 방법**과 디자인 완료 주장의 경계를 소유합니다. 공통 독립 검토, snapshot,
reviewer/runner 권한과 결과 양식은 [QA](../qa.md)를 재사용합니다. Reviewer의 판정은 사람의 취향 승인이 아닙니다.

## 근거와 적용 결정

공식 지침·사례에서 가져온 절차와 이 저장소에서 선택한 운영 방식을 구분합니다. 아래 확인 기준일은 **2026-09-10**입니다.

| 근거                                                                                                                                                                                            | 확인된 내용과 한계                                                                                                                                      | 저장소 적용 판단                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [Anthropic frontend-design 고정 revision](https://github.com/anthropics/skills/blob/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design/SKILL.md)                                   | 맥락에 맞는 구체적 디자인 계획, 자체 점검과 렌더링 기반 비평을 제시합니다. 제품의 승인된 스타일을 대신 결정하지 않습니다.                               | 기존 VisualBrief에 짧은 craft sketch를 추가합니다. 스킬 설치나 원문의 스타일 기본값 복제는 요구하지 않습니다. |
| [Anthropic harness 실험](https://www.anthropic.com/engineering/harness-design-long-running-apps)                                                                                                | 생성·평가 분리와 브라우저 피드백을 실험했습니다. 주관적 채점은 관대해질 수 있고, 평가 문구가 스타일을 편향시키거나 마지막 결과가 덜 선호될 수 있습니다. | 근거가 있는 비평과 keep/revert를 사용합니다. 긴 반복 횟수, 미적 점수, 개선 보장은 가져오지 않습니다.          |
| [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) · [screenshot assertion](https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-screenshot-1) | 안정화한 화면도 환경에 따라 달라질 수 있습니다. 픽셀 비교는 아름다움이나 상호작용의 정답이 아닙니다.                                                    | 동일 조건의 전후 캡처와 별도 동작 검증을 사용합니다.                                                          |
| [토스 휴리봇 사례](https://toss.tech/article/research-platform-ai) (2024-12-02)                                                                                                                 | AI 사용성 점검과 실제 사용자 검증을 구분하며 반영 판단은 디자이너에게 둡니다.                                                                           | Agent의 사용성 의견은 가설로, 사용자 관찰과 Owner 판단은 별도로 기록합니다.                                   |
| [SEED Skill](https://seed-design.io/ai-integration/skill)                                                                                                                                       | 디자인 지식·구현·진단을 나누고 공식 원문으로 안내합니다. 이 저장소의 도입 성과를 의미하지 않습니다.                                                     | 작은 진입점과 owner 링크를 재사용합니다. SEED 설치·디자인 상속·복제 schema는 추가하지 않습니다.               |

모델 안내·일반 코딩 benchmark만으로 GPT/Claude의 디자인 순위를 정하지 않습니다. 기업의 AI 작성 코드 비율도
디자이너 대체율·사용성·디자인 승인 비율이 아닙니다. 제품 디자이너의 사례, 디자인 시스템 도구, HCI나 GenAI 평가 사례는
참고 관점일 뿐 이 제품의 미감이나 성과를 증명하지 않습니다. 계정·도구의 현재 접근은 [Figma evidence](./figma-mcp-evidence.md)가
별도로 확인합니다. 유용한 절차만 채택하고, 검증하지 않은 수치·모델 성격·회사 내부 사정은 결과에 포함하지 않습니다.

이 하네스가 가설로 두는 이익은 **구체적인 선택과 실제 피드백으로 디자인 논의를 개선하는 것**입니다. 문서와 정적 검사만으로
시각적 완성도·시간 절약·사용자 성공률이 좋아졌다고 말하지 않습니다. 작업별 관측과 남은 gap은 [Lifecycle](../development-lifecycle.md)의
verification/value validation 구분을 따릅니다.

## 두 종류의 acceptance

**Exploration:** 같은 콘텐츠·상태·viewport에서 실제 렌더링한 대안, 의미 있는 차이와 tradeoff, Owner에게 줄
선택/수정/기각 packet을 확인합니다. 기본 두 후보이며 다른 가설이 유용할 때만 세 번째를 만듭니다. IA 검토에는 wireframe이
가능하지만 미감 비교에는 스타일이 적용된 화면이 필요합니다. 단순 색상 교체를 구조적 대안으로 포장하지 않습니다.

**Approved implementation:** 승인된 후보 revision과 intent를 기준으로 내용·동작 보존, 해당 접근성 요구, viewport별
fidelity와 코드 검증을 확인합니다. 동일한 픽셀을 모든 기기·콘텐츠에서 강제하지 않습니다. 실제 컴포넌트를 바꿨다면
production surface와 Storybook의 상태 정합성도 검증합니다. 정적 HTML prototype은 production parity의 증거가 아닙니다.

구현·리뷰 기준: [web-fe-component-architecture.md F5](../review-criteria/web-fe-component-architecture.md#f5-예시-렌더-표면의-우회-금지)

표현 분리·공통 행동·점진 적용은 [표현 책임·device 검증](./device-presentation-and-verification.md)을 기준으로 검토합니다.
프로젝트 이름 대신 실제 viewport/input/state/action과 양쪽 성공 캡처·gap을 확인합니다. 문서-only 채택·읽기 전용 사례
검토를 실제 화면 전환이나 browser/RN 검증 완료로 승격하지 않습니다.

| 판정                         | 필요한 근거                                           | 대체할 수 없는 것                                         |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| functional/a11y verification | 내용·상태·action, keyboard/focus/reflow와 해당 테스트 | 예쁜 screenshot이 필수 검사를 면제하지 않음               |
| reference fidelity           | 승인된 reference aspect와 동일 조건의 실제 비교       | reference가 없으면 not-applicable; 추측으로 PASS하지 않음 |
| usability evidence           | 실제 사용자·과제 관찰; 없으면 가설과 unvalidated 표시 | 합성 persona나 Agent 의견은 사용자 연구가 아님            |
| owner visual preference      | 사람이 선택/수정/기각한 대상 revision과 범위          | Agent 점수·침묵·기술 QA PASS는 승인 아님                  |

구현·리뷰 기준: [web-fe-accessibility.md F1](../review-criteria/web-fe-accessibility.md#f1-의미-있는-요소와-접근-가능한-이름), [web-fe-accessibility.md F2](../review-criteria/web-fe-accessibility.md#f2-keyboard와-focus), [web-fe-accessibility.md F3](../review-criteria/web-fe-accessibility.md#f3-상태-알림과-비활성-이유), [web-fe-layout-responsive-device.md F3](../review-criteria/web-fe-layout-responsive-device.md#f3-viewportscroll-검증)

각 작업은 어느 판정이 완료에 필요한지 먼저 밝힙니다. 하네스/제안 전달 작업은 preference가 `pending/not-collected`여도
정의된 범위에서 끝낼 수 있지만, 이를 production 디자인 승인으로 표현하지 않습니다. 필수 기능·권한 위반은 취향 차이로
완화하지 않습니다. 접근성 문제와 Owner 선호가 충돌하면 그 방향을 살린 접근 가능한 대안을 제시합니다.

## Assertion transition before UI changes

승인된 개편에서도 테스트의 미감과 보호 의미를 구분합니다. 기존 class 때문에 새 방향을 축소하거나 파일 전체를 삭제하지 않습니다.

1. 영향 surface의 instruction·token·class/text/DOM assertion·snapshot을 조사합니다. 전 화면 inventory는 불필요합니다.
2. `assertion → 보호 intent → authority/source → preserve/replace/retire → replacement evidence`를 매핑합니다.
3. 현재 semantic regression baseline을 확보하고 **대체 회귀를 먼저 정의한 뒤** 충돌하는 미감 guard의 교체를 설계합니다.
   실제 UI branch에서 필요한 test 전환과 구현을 RED→GREEN으로 진행합니다. 기존 PASS를 인위적인 결함으로 세지 않습니다.
4. 개인정보·상태·action·정책·a11y 보호는 유지하고, 새 palette/layout/copy는 승인된 revision으로 검증합니다.
   blanket snapshot 갱신·미감 테스트 전부 삭제는 대체 검증이 아닙니다.

예: header의 blur 부재 assertion은 개편 시 교체할 수 있지만 home link 의미는 보존합니다. Login의 grid/spacing은
reflow·reset action·고지 노출을 보호할 수 있으므로 cosmetic이라고 일괄 제거하지 않습니다. Roommate 카드의 색은
바꿔도 private detail/token 비노출 회귀는 유지합니다. Hero 문구/heading 순서는 [copy 권한](./reference-content-contract.md)을
분류하고, 학교 이메일 lookalike 거절은 미감과 무관한 eligibility/security 불변 조건으로 남깁니다.

실제 변경은 [표현·device packet](./device-presentation-and-verification.md)과
[token/theme 계약](./web-semantic-token-contract.md)을 소비하고 production/fixture의 해당 state를 대조합니다.
이 절차 채택 자체는 제품 테스트 삭제나 현재 화면 baseline 전환 완료가 아닙니다.

구현·리뷰 기준: [swe.md S6](../review-criteria/swe.md#s6-보호-test)

## Anti-slop은 맥락 비평이지 CSS 금지 목록이 아님

AI-slop은 작성자를 탐지하는 지표가 아니라 **이 brief를 검토하지 않고 반복한 template 선택**으로 다룹니다.
Glass, gradient, bento, 큰 radius, serif, minimalism, 강한 색이나 motion은 일괄 금지·권장이 아닙니다.

- 제목·본문·메타데이터의 강조 순서가 사용자의 일과 맞는가?
- 긴 한국어 문장과 표가 읽히는가? 반복 카드·badge·번호에 실제 정보상의 이유가 있는가?
- 간격·밀도·색·효과가 탐색과 읽기를 돕는가, 내용 누락을 가리는가?
- 실제 없는 성공 지표·후기·광고 문구·불필요한 hero가 target 정보를 대신하지 않는가?

**허용 예시:** Owner가 투명한 도구 영역을 선택했다면 배경 대비, focus와 읽기, reduced motion/성능을 확인하면서 그 효과를
유지할 수 있습니다. **기각 예시:** 조항을 빨리 찾아야 하는 문서에 근거 없는 후기·숫자와 동일한 카드 hero를 얹고
필수 표를 접어 숨겼다면, generic함의 문제가 아니라 정보·목표 위반부터 고칩니다. 이것은 모든 hero나 접힘 UI의 금지가 아닙니다.

## Located critique와 disposition

[VisualAuditFinding](./visual-brief.md#visualauditfinding)을 사용합니다. Hard finding을 먼저 보고하고, 별도로 시각적 위계,
타이포·한국어 줄바꿈, 구성·간격·밀도에서 영향이 큰 **최대 1–3개**를 우선합니다. 고정 개수의 결함이나 점수를 만들지 않습니다.
관찰, 사용성 가설, 취향을 구분하고 근거가 없으면 `not-observed` 또는 설명 있는 `no-change`로 둡니다.

아래는 **작성 형식 예시이며 실제 실행/승인 결과가 아닙니다.**

```text
candidate B / revision r1 / 390×844 / available-fallback
evidence: B-r1-390.png, upper metadata region (x:20–370, y:220–390)
observation: metadata labels occupy three equal blocks; body and labels have equal emphasis
hypothesis: readers seeking a clause may scan metadata before locating the section navigation
suggested repair: reduce metadata emphasis and regroup it, preserving every visible label/value
confidence: medium; owner's taste and real task-success improvement are unmeasured
parent disposition: adopt grouping trial; reject removing dates (exact-copy invariant); defer new font (separate asset decision)
delta: same content/state/viewport; r2 screenshot + content/focus checks compared with r1
keep/revert: record observed reason; revert if scan hierarchy is not helped or a hard check regresses
owner preference: not-collected, not implied by this example
```

「깔끔하다」「AI 같다」만으로는 수정할 위치·영향을 알 수 없습니다. Parent는 채택/기각/보류와 이유를 짧게 남겨 이미
기각한 취향 제안이 반복되지 않도록 합니다. CSS 값마다 승인을 요청하는 대신 승인 범위의 수정안을 실행하되, 제품·비용·위험이나
합의한 방향 변경은 [Owner–Lead](../owner-lead-collaboration.md)의 협의 경계를 사용합니다.

시각 비평도 현재 host의 독립 리뷰 진입점으로 돌립니다. Parent가 비평 subject를 정하고 비평할 캡처 PNG를 read path로 줍니다.
등록·호출·정산은 [현재 host adapter](../adapters/README.md)를 따릅니다.

## 실제 수정 루프

시각 작업의 검토 순서는 이 절 하나가 소유합니다.

1. 모든 후보를 같은 콘텐츠·[대표 상태 묶음](./visual-brief.md#verification)·viewport로 렌더합니다.
2. Owner에게 보이기 전에 지킬 것(고지·대비·접근성)을 결정적 검사로 확인합니다. 방향이 맞아도 고지 누락이나 대비 실패가
   있으면 Owner의 방향 판단이 흐려집니다.
3. Owner가 방향을 고릅니다(select/revise/reject).
4. 고른 후보에만 `isolated critique → adopt/reject/defer → authorized patch → recapture → keep/revert`를 사용합니다.
   [공통 maker-checker](../orchestration.md#pattern-selector)를 따라 기본 최대 두 번의 critique→revision cycle로 제한합니다.
5. Owner가 확정합니다(`W-DESIGN` 확정 기록, [lifecycle state machine](../lifecycle-state-machine.md#확인-주체와-강도)).

의견이 안 모이면 결과와 정확한 질문을 돌려주며, 새 방향은 brief를 다시 여는 별도 판단입니다. 마지막 revision이 항상
더 좋다고 가정하지 않고, 동일/악화 또는 이전 후보 유지도 관찰 결과로 남깁니다.

- content/map hash, candidate revision, viewport/scale, locale와 브라우저 버전을 고정합니다.
- 사용 가능한 font/asset, font 로드 완료, 색상·reduced-motion, 애니메이션·동적 데이터 처리 조건을 기록합니다.
- 실제 그린 글꼴(platform font)을 기록합니다. 글꼴 finding은 축소 스크린샷이 아니라 그 기록으로 판정합니다.
- 전후 중요 영역과 전체 구성을 함께 보존합니다. 필수 콘텐츠를 가리거나 masking해서 비교를 통과시키지 않습니다.
- screenshot 안정화는 별도 interaction/keyboard 검증을 대체하지 않습니다. 실제 이미지를 보지 못하면 시각 판정은 BLOCKED입니다.
- Renderer는 허용된 환경·출력 경로만 쓰고, reviewer는 공통 QA의 read-only/runner 구분을 따릅니다.

검증 probe와 결함 수정에는 다음을 함께 씁니다.

- **probe 양성·음성 대조:** probe는 고치기 전 build에서 실패를 재현하고, 일부러 깨뜨린 입력을 잡는지 확인한 뒤 근거로 씁니다.
  값을 바꿔도 결과가 같으면 story arg 연결부터 의심합니다.
- **원인 먼저:** 시각 결함은 고치기 전에 CSS를 덧씌운 캡처 한 쌍으로 원인을 확인합니다. 측정 실패는 전환 중간 프레임 때문인지
  따로 재고, 선택지를 쓰기 전에 그 동작이 이미 있는지 확인합니다.
- **접근 경로 함께 정하기:** hover로만 동작하는 요청은 키보드·터치 경로를 먼저 정합니다. 기능을 지우거나 끄면 그 기능의
  키보드·터치 경로와 안내 문구를 다시 확인하고, 계속 움직이는 요소는 멈춤 수단을 함께 제안합니다.

일반 작업은 근거 있는 no-change로 끝날 수 있습니다. **수정 하네스 자체를 검증한다고 할 때는** 실제 patch·recapture·독립
delta 검토가 있어야 하며 절차를 써놓는 것만으로 통과시키지 않습니다. 본 후보에 수정 근거가 없으면 명시된 보조 composition
challenge를 격리된 로컬 출력에서 사용할 수 있습니다. Production을 일부러 망가뜨리거나 정답을 reviewer에게 주지 않습니다.
이는 피드백 처리 능력의 검증이지 강제로 얻은 디자인 개선 점수가 아닙니다.

2026-09-10 provider-free 관측 사례는 [Visual design provider-free observation evidence](../../../evidence/agent-workflows/visual-design-provider-free-observation.md)에 있습니다.
