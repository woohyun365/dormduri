# 매칭 알고리즘 정책

## 문서 범위

이 문서는 호환도 점수 산출의 구체적 알고리즘 — 점수 행렬, 정규화 공식, 예외 처리 — 을 다룬다.

- 비교 구조, 가중치 티어, viewer 기준 점수 원칙: [matching-lifecycle.md](./matching-lifecycle.md)
- 필드 옵션 상세: [profile-model.md](./profile-model.md)

## 점수 산출 공식

### 관점별 점수

```
A↔B 호환도:
  A 관점: B의 행동 vs A의 조건 → A가 B를 수용하는가
  B 관점: A의 행동 vs B의 조건 → B가 A를 수용하는가
  사용자 surface canonical 값:
    perspectiveScore(viewer, target)
```

현재 정책에서 사용자에게 노출하는 match score는 항상 viewer 기준 단방향 점수 하나다. `min(A 관점, B 관점)` 공통점수는 사용자-facing canonical 값으로 사용하지 않는다.
또한 이 점수는 **viewer와 target 모두 complete season profile**일 때만 생성 대상으로 본다.

### 관점 점수 계산

```
perspective_score(evaluator, target):
  weightedSum = Σ (score_i × weight_i)    // 적용 대상 쌍만
  dynamicMax  = Σ weight_i                // 적용 대상 쌍만
  return round((weightedSum / dynamicMax) × 100)
```

### 동적 정규화

`dynamicMax`는 실제 비교에 참여한 쌍의 가중치 합이다. FLEXIBLE 등으로 제외된 쌍은 분자(weightedSum)와 분모(dynamicMax) 모두에서 빠진다. 이를 통해 **모든 참여 쌍이 만점이면 100점**을 보장한다.

기본 max (전 쌍 참여 시): **35**

## 13쌍 분류

| 유형    | 패턴                     | 해당 쌍                                                                                 | 점수 방식                                                       |
| ------- | ------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| TYPE A  | Threshold (임계값)       | smoking                                                                                 | 행동이 허용 범위 안이면 1.0, 밖이면 0.0. 허용 범위 내 정밀 차등 |
| TYPE A' | 하이브리드 (거리+무조건) | drinking                                                                                | ANY이면 무조건 1.0, LOW_ONLY이면 거리 계산                      |
| TYPE B  | Matrix (행렬)            | sleepHabit×noise, phone, earphone, sleepEnv(소리), screenUsage(빛), indoorEating, clean | 조합별 개별 점수 (0.0~1.0)                                      |
| TYPE C  | Distance (거리)          | bedtime, wakeTime, temperature                                                          | 순서 스케일 간 거리 기반                                        |
| TYPE D  | Match (일치)             | relationshipStyle                                                                       | 동일 값이면 1.0, 다르면 0.0                                     |

## 점수 행렬

### Pair 1: smokingBehavior × smokingTolerance (T1=5, TYPE A)

| 행동 \ 조건 | NO_ONLY | E_CIG_OK | ANY |
| ----------- | ------- | -------- | --- |
| NO          | 1.0     | 1.0      | 1.0 |
| E_CIG       | 0.0     | 1.0      | 1.0 |
| YES         | 0.0     | 0.0      | 1.0 |

### Pair 2: drinkingFrequency × drinkingTolerance (T3=2, TYPE A' 하이브리드)

drinkingTolerance가 LOW_ONLY이면 거리 계산, ANY이면 무조건 1.0.

순서 스케일: NONE(0) → RARELY(1) → SOMETIMES(2) → OFTEN(3)
LOW_ONLY: score = 1.0 - (index / 3)

| 행동 \ 조건 | LOW_ONLY | ANY |
| ----------- | -------- | --- |
| NONE        | 1.0      | 1.0 |
| RARELY      | 0.67     | 1.0 |
| SOMETIMES   | 0.33     | 1.0 |
| OFTEN       | 0.0      | 1.0 |

### Pair 3: sleepHabit × noiseSensitivity (T1=5, TYPE B)

| 행동 \ 특성 | SENSITIVE | NORMAL | DEEP |
| ----------- | --------- | ------ | ---- |
| NONE        | 1.0       | 1.0    | 1.0  |
| TALKING     | 0.3       | 0.8    | 1.0  |
| SNORING     | 0.0       | 0.3    | 0.8  |
| GRINDING    | 0.0       | 0.5    | 1.0  |

- NONE: 잠버릇 없음 → 모든 잠귀에 만점
- TALKING: 잠꼬대 → 민감한 잠귀에 경미한 수용 가능성(0.3)
- SNORING: 코골이 → 지속적·고볼륨. 보통 잠귀도 새벽 각성 시 재입면 어려움(0.3). 잠귀 둔해도 심한 경우 영향(0.8)
- GRINDING: 이갈이 → 날카롭지만 간헐적. 보통 잠귀는 버틸 수 있음(0.5). 잠귀 둔하면 무영향(1.0)

### Pair 4: phoneBehavior × phoneTolerance (T2=3, TYPE B)

| 행동 \ 조건 | OUTSIDE_ONLY | BRIEF_OK | ANY |
| ----------- | ------------ | -------- | --- |
| RARELY      | 1.0          | 1.0      | 1.0 |
| SOMETIMES   | 0.0          | 1.0      | 1.0 |
| OFTEN       | 0.0          | 0.3      | 0.7 |

### Pair 5: earphoneUsage × earphoneExpectation (T2=3, TYPE B)

| 행동 \ 조건    | MUST | STUDY | ANY |
| -------------- | ---- | ----- | --- |
| ALWAYS         | 1.0  | 1.0   | 1.0 |
| MOSTLY         | 0.7  | 1.0   | 1.0 |
| MOSTLY_SPEAKER | 0.0  | 0.7   | 1.0 |
| ALWAYS_SPEAKER | 0.0  | 0.3   | 1.0 |

- ALWAYS: 항상 이어폰 → MUST 완벽 충족
- MOSTLY: 주로 이어폰 → MUST에 높은 충족(0.7, 대부분 상황에서 이어폰)
- MOSTLY_SPEAKER: 주로 스피커 → STUDY에 부분 수용(0.7)
- ALWAYS_SPEAKER: 항상 스피커 → STUDY에 약간 수용(0.3)

### Pair 6: sleepEnvironment × sleepEnvPreference (T2=3, TYPE B) — 소리 축

잠들 때 소리 방식을 비교한다. 소리만 다루며, 화면 빛은 Pair 6b에서 별도 비교한다. 소리 관점에서 QUIET와 EARPHONE은 상대에게 동일한 영향(소리 없음)이므로, 실질적으로 "스피커 사용 여부"가 핵심 갈등이다.

| 행동 \ 조건 | NO_SPEAKER | SPEAKER_OK |
| ----------- | ---------- | ---------- |
| QUIET       | 1.0        | 1.0        |
| EARPHONE    | 1.0        | 1.0        |
| LOW_SPEAKER | 0.0        | 1.0        |

- QUIET, EARPHONE: 상대에게 소리 전달 없음 → NO_SPEAKER와도 1.0
- LOW_SPEAKER: 스피커 소리 → NO_SPEAKER와 비호환(0.0)

### Pair 6b: screenUsage × screenTolerance (T2=3, TYPE B) — 빛 축

잠들 때 화면 사용을 비교한다. 소리와 독립적인 축으로, 화면 빛이 상대에게 방해가 되는지를 판단한다.

| 행동 \ 조건 | NO_SCREEN | LOW_OK | SCREEN_OK |
| ----------- | --------- | ------ | --------- |
| NONE        | 1.0       | 1.0    | 1.0       |
| AUDIO       | 1.0       | 1.0    | 1.0       |
| SCREEN      | 0.0       | 0.5    | 1.0       |

- NONE, AUDIO: 화면 빛 없음 → 모든 조건과 1.0
- SCREEN × NO_SCREEN: 화면 빛 있음 → 비호환(0.0)
- SCREEN × LOW_OK: 밝기 낮추면 부분 수용(0.5)

소리 축과 빛 축을 분리한 근거: 소리와 빛은 독립적인 갈등 요인이다. 이어폰+화면 켜짐(소리 없음, 빛 있음)과 스피커+화면 꺼짐(소리 있음, 빛 없음)은 방해 유형이 다르며, 단일 Pair로는 이 조합을 정확히 포착할 수 없다. (#157 UX 분석에서 도출)

### Pair 7: cleanLevel × cleanExpectation (T3=2, TYPE B)

| 행동 \ 조건 | STRICT | BASIC | FLEXIBLE |
| ----------- | ------ | ----- | -------- |
| WEEKLY_3_UP | 1.0    | 1.0   | 1.0      |
| WEEKLY_1_2  | 0.3    | 1.0   | 1.0      |
| WHEN_DIRTY  | 0.0    | 0.3   | 1.0      |

- WEEKLY_3_UP: 주 3회+ → STRICT에도 충족
- WEEKLY_1_2: 주 1~2회 → STRICT에 부분(0.3, 기본은 하지만 기대 미달)
- WHEN_DIRTY: 필요할 때만 → BASIC에 약간 수용(0.3)

### Pair 7b: indoorEating × indoorEatingTolerance (T3=2, TYPE B) — 실내 취식

| 행동 \ 조건 | NO_SMELL | CLEAN_OK | ANY |
| ----------- | -------- | -------- | --- |
| RARELY      | 1.0      | 1.0      | 1.0 |
| SNACK       | 1.0      | 1.0      | 1.0 |
| MEAL        | 0.0      | 0.5      | 1.0 |

- RARELY: 잘 안 먹어요 → 모든 조건에 만점
- SNACK: 간식은 먹어요 → 냄새 없는 수준, NO_SMELL에도 1.0
- MEAL: 배달·간편식도 먹어요 → NO_SMELL과 비호환(0.0), CLEAN_OK는 환기/정리로 중간 수용(0.5)

### Pair 8: bedtime (T3=2, TYPE C — 유사도 비교)

순서 스케일: `BEFORE_22`(0) → `22_24`(1) → `24_02`(2) → `AFTER_02`(3)

```
score = 1.0 - (|indexA - indexB| / 3)
```

| A \ B     | BEFORE_22 | 22_24 | 24_02 | AFTER_02 |
| --------- | --------- | ----- | ----- | -------- |
| BEFORE_22 | 1.0       | 0.67  | 0.33  | 0.0      |
| 22_24     | 0.67      | 1.0   | 0.67  | 0.33     |
| 24_02     | 0.33      | 0.67  | 1.0   | 0.67     |
| AFTER_02  | 0.0       | 0.33  | 0.67  | 1.0      |

### Pair 9: wakeTime (T4=1, TYPE C — 유사도 비교)

순서 스케일: `BEFORE_07`(0) → `07_08`(1) → `08_09`(2) → `09_10`(3) → `AFTER_10`(4)

```
score = 1.0 - (|indexA - indexB| / 4)
```

**FLEXIBLE 처리**: 한쪽이라도 FLEXIBLE이면 해당 쌍을 분자·분모 모두에서 제외한다 (true neutral). FLEXIBLE은 "유동적·수업에 따라"를 의미하므로 점수에 영향을 주지 않는다.

### Pair 10: temperatureSensitivity (T2=3, TYPE C — 유사도 비교)

순서 스케일: `COLD`(0) → `NORMAL`(1) → `HOT`(2)

```
score = 1.0 - (|indexA - indexB| / 2)
```

| A \ B  | COLD | NORMAL | HOT |
| ------ | ---- | ------ | --- |
| COLD   | 1.0  | 0.5    | 0.0 |
| NORMAL | 0.5  | 1.0    | 0.5 |
| HOT    | 0.0  | 0.5    | 1.0 |

### Pair 11: relationshipStyle (T4=1, TYPE D — 일치 비교)

`score = A === B ? 1.0 : 0.0`

2개 옵션(CLOSE / CASUAL) 간 같으면 1.0, 다르면 0.0.

## 가중치 티어 총괄

| 티어           | 가중치 | 쌍                                                            | 소계   |
| -------------- | ------ | ------------------------------------------------------------- | ------ |
| T1 Dealbreaker | 5      | smoking, sleepHabit×noise                                     | 10     |
| T2 High        | 3      | phone, earphone, temperature, sleepEnv(소리), screenUsage(빛) | 15     |
| T3 Moderate    | 2      | clean, drinking, bedtime, indoorEating                        | 8      |
| T4 Lower       | 1      | wakeTime, relationshipStyle                                   | 2      |
| **합계**       | —      | **13쌍**                                                      | **35** |

## 설계 원칙

1. 행렬 값은 **"조건을 세운 쪽의 수용 가능성"**을 기준으로 설정한다.
2. TYPE A/B(교차 비교)는 관점에 따라 비대칭이다 — target 행동 vs evaluator 조건.
3. TYPE C/D(유사도 비교)는 대칭이다 — 양쪽 관점에서 동일 결과.
4. 점수 행렬 변경은 이 문서를 단독 수정하고, 코드에 반영한다.

## 변경 이력

| 날짜       | 변경 내용                                                                                                                                                                                                                                             | 관련 이슈 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 2026-03-18 | 초안 작성: 13쌍 점수 행렬, 정규화 공식, FLEXIBLE 처리                                                                                                                                                                                                 | #152      |
| 2026-03-18 | sleepHabit×noise 행렬 수정: SNORING 패널티 강화(NORMAL 0.5→0.3, DEEP 1.0→0.8), GRINDING 완화(NORMAL 0.3→0.5). 코골이가 이갈이보다 지속적·고볼륨                                                                                                       | #152      |
| 2026-03-18 | 가중치 스왑: temperatureSensitivity T4→T2(에어컨/난방 공유 자원 갈등), nightStudy T2→T3(시험기간 한정, 대화 해결 가능), indoorEating T3→T4(선호 수준). dynamicMax 33 유지                                                                             | #152      |
| 2026-03-18 | nightStudyLocation→nightStudyLight 리프레이밍: 장소가 아닌 빛 갈등 직접 포착. 옵션 ROOM/OUTSIDE/BOTH→OUTSIDE/LOW_LIGHT/DESK_LAMP. nightStudyTolerance→nightLightTolerance, QUIET_OK→LOW_OK                                                            | #152      |
| 2026-03-18 | nightStudyLight × nightLightTolerance(Pair 6) 제거: 체크리스트 근거 없음, 커뮤니티 분석 무영향, bedtime이 빛 갈등 근본 원인 커버. 13→12쌍, dynamicMax 33→31                                                                                           | #152      |
| 2026-03-19 | Pair 6 근거 재정의: "소리" → "미디어 사용(소리+화면 빛)". EARPHONE×QUIET_ONLY=0.0 유지 근거 명시                                                                                                                                                      | #157      |
| 2026-03-19 | Pair 6 소리/빛 2축 분리: 단일 3×3 → 소리 3×2(Pair 6) + 빛 3×2(Pair 6b). sleepEnvPreference 3→2옵션, screenTolerance 신규. 12→13쌍, dynamicMax 31→34                                                                                                   | #157      |
| 2026-03-19 | Phase C 생활 패턴 재설계: Pair 2 RARELY행 추가(4×3), Pair 4 enum 변경(OFTEN×ANY=0.7), Pair 5 4단계 그라디언트, Pair 7b indoorEating×indoorEatingTolerance 신규(T3=2 TYPE B), Pair 11 indoorEating 일치 제거. 13쌍 유지, dynamicMax 34→35              | #157      |
| 2026-03-19 | Phase D 룸메 조건 재설계: Pair 2 drinkingTolerance 3→2옵션(LOW_ONLY/ANY), TYPE A→하이브리드(거리+무조건), 4×3→4×2 매트릭스. Pair 6b screenTolerance 2→3옵션(NO_SCREEN/LOW_OK/SCREEN_OK), 3×2→3×3 매트릭스(SCREEN×LOW_OK=0.5). 13쌍·dynamicMax 35 유지 | #157      |
| 2026-05-11 | 사용자-facing canonical score를 `perspectiveScore(viewer, target)` 단일값으로 고정하고, 문서의 `min(A,B)`/partial 설명을 제거. 알고리즘 문서는 관점 점수 계산식 자체만 소유하도록 정리                                                                | #195      |

## 원문 소스

- `docs/03_planning/sprint-5/152-step4-redesign-lifestyle21.md` (결정 과정 상세)
- `docs/04_policy/matching.md` (가중치 결정 원본)
