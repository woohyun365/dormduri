# KNU Roommate

강원대학교 재학생을 위한 **시즌 기반 기숙사 룸메이트 탐색·매칭 서비스**입니다.

이 저장소는 단순 기능 구현보다, 정책을 도메인 모델과 API 계약으로 고정하고 검증하는 과정을 포트폴리오의 핵심 근거로 둡니다.

## 이 프로젝트에서 증명하고 싶은 것

- **정책 → 도메인 모델 → API 계약 → 테스트**로 이어지는 개발 체계를 설계했습니다.
- `User` 중심 legacy 구조를 `UserDisplayIdentity` / `UserAcademicIdentity` / `SeasonParticipant` 중심으로 재정렬했습니다.
- 룸메이트 찾기 기능을 summary/detail/action/result-read 축으로 분리하고, manifest 기반 필터·cursor pagination·query-time score sort를 구현했습니다.
- 탈퇴/비식별화 이후에도 신고·분쟁 대응에 필요한 데이터를 RRPD retained vault로 분리 보존하는 BE foundation을 설계했습니다.
- AI 도구는 코드 작성·리뷰·인수 검증에 활용하되, 정책 판단과 최종 적용 여부는 사람이 결정하는 워크플로를 운영했습니다.

## 현재 구현 스냅샷

| 영역                 | 현재 상태                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth / Users         | 학교 이메일 인증 코드, signup draft 검증, argon2id 비밀번호, JWT session, login lockout, reset password, account identity invariant                            |
| Account identity     | 표시 identity(`UserDisplayIdentity`)와 학업 identity(`UserAcademicIdentity`) 분리. 닉네임/단과대/출생연도 수정 정책과 감사 이력 기반 마련                      |
| Season participation | 시즌 프로필 draft, 기숙사 선택 draft, registration finalize, deregistration, registration snapshot/history 생성                                                |
| Roommate search      | `SeasonParticipant`를 public target root로 사용. scope manifest, filter manifest, cursor-only pagination, `NICKNAME`/`MATCH_SCORE` 정렬, min score preset 지원 |
| Public profile       | list-summary / detail / score / action capability 분리. 정상 entry context 기반 tombstone detail과 direct probing fail-closed 처리                             |
| Match / Chat         | match request, accept/reject/cancel, active match, unmatch request, history read, thread lifecycle, `canSendMessage=false` reason payload                      |
| Retention            | RRPD retained vault, archive job, retained vault access log, disposal, chat body vault 전환, account deletion de-identification foundation                     |
| Test                 | API unit/integration 중심 Jest 테스트 + web Vitest 테스트. 현재 repo 기준 `*.spec.ts`/`*.test.ts` 100개 이상                                                   |

> 현재 단계는 제품 릴리즈 전 개발 단계입니다. 운영 배포·실사용자 검증·admin/backoffice UI는 후속 범위입니다.

## 핵심 기술 결정

| 영역                | 기술                                     | 선택 이유                                                                                                                 |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Language            | TypeScript                               | FE/BE/shared contract를 같은 타입 언어로 연결하고 정책 enum/schema drift를 줄이기 위함                                    |
| Monorepo            | pnpm workspace                           | `apps/web`, `apps/api`, `packages/shared` 간 계약 공유와 의존성 경계를 명확히 하기 위함                                   |
| Frontend            | Next.js 16, React 19                     | App Router 기반 화면 구조와 인증 BFF 경계를 함께 다루기 위함                                                              |
| Backend             | NestJS 11                                | 모듈/DI 구조가 auth, users, seasons, profiles, matches, chat, retention 같은 정책 도메인 분리에 적합                      |
| Database            | PostgreSQL 16 + Prisma 7                 | 관계형 제약, transaction, migration, generated client 기반 타입 안정성을 함께 확보                                        |
| Contract            | Zod schemas in `packages/shared`         | API request/response, roommate-search manifest, identity/profile/match/chat contract를 런타임 검증과 타입으로 동시에 사용 |
| Validation / Config | Joi + Nest Config                        | production 필수 secret과 dev default를 명확히 분리                                                                        |
| Test                | Jest, Supertest, Vitest, Testing Library | BE owner 단위/통합 테스트와 FE component 테스트를 분리                                                                    |
| Styling             | Tailwind CSS 4                           | 정책 변화에 따라 UI 상태가 자주 바뀌는 프로토타입 단계에서 빠르게 조정 가능                                               |

## 백엔드 설계 포인트

### 1. SeasonParticipant 중심 도메인 재정렬

룸메이트 탐색·매칭·채팅의 canonical target은 account `User`가 아니라 current season의 `SeasonParticipant`입니다.

- signup/auth는 `User`와 account identity만 만든다.
- 시즌 프로필 draft와 기숙사 선택 draft는 registration 전까지 독립 저장 가능하다.
- registration finalize만 `REGISTERED + ASSIGNED + registeredAt + complete profile + SEASON_REGISTRATION history`를 확정한다.
- search/detail/match/chat capability는 registration complete participant를 기준으로 계산한다.

이 구조로 account identity, season participation, public exposure, match/chat action capability를 분리했습니다.

### 2. Public target capability 축 분리

기존의 단일 public exposure 표현 대신 아래 축을 분리했습니다.

| 축                      | 의미                                                        |
| ----------------------- | ----------------------------------------------------------- |
| Relation                | viewer와 target의 관계: general target / matched partner    |
| Exposure                | list-summary, detail, score를 어디까지 볼 수 있는가         |
| Action capability       | bookmark, match request, chat start 같은 새 행동이 가능한가 |
| Result-read context     | 이미 생성된 match/thread/history를 읽는 맥락인가            |
| Read-only storage state | thread/profile row 자체가 쓰기 잠금 상태인가                |

이 분리 덕분에 “목록에는 보이지만 상세/점수/action은 닫힘”, “과거 최종 매칭 상대의 detail은 result-read로 허용”, “정상 entry context는 tombstone으로 degrade” 같은 상태를 명확히 표현할 수 있습니다.

### 3. Roommate-search filter / cursor / score 설계

룸메이트 찾기는 `CAMPUS_MERGED`와 `SAME_BUILDING_ONLY` scope를 가진 summary list API입니다.

- `GET /api/roommate-search/manifest`가 scope별 필터/정렬 가능성을 preflight로 제공한다.
- `GET /api/roommate-search`는 response에도 authoritative manifest를 포함해 stale UI state를 방어한다.
- pagination은 offset이 아니라 HMAC cursor token과 query digest를 사용한다.
- `MATCH_SCORE` 정렬은 projection table precompute가 아니라 query-time score calculation으로 구현했다.
- bounded cache는 실제 병목이 측정된 뒤 후속 issue에서 도입한다.

관련 제품 경계와 계산 기준은 `docs/policies/roommate-searching.md`, `docs/policies/matching-algorithm.md`, `docs/policies/production-deployment-readiness.md`에서 관리합니다.

### 4. Account deletion / retention foundation

탈퇴는 단순 row 삭제가 아니라 user-facing 비식별화와 restricted retention을 분리합니다.

- active `User`/display/profile surface는 즉시 비식별화한다.
- 정상 탈퇴 identifier anchor는 `RetainedIdentity`로 제한 보존한다.
- nickname audit, academic identity audit, season profile history, match history, chat body는 `RetainedVaultObject`로 원문 payload를 분리할 수 있다.
- retained payload 접근은 purpose/approval/access log 없이는 허용하지 않는다.

이 구조는 “사용자 화면에는 탈퇴한 사용자로 보이지만, 신고·분쟁·법적 보존 사유가 있으면 승인된 운영 경로에서만 근거를 복원할 수 있는” foundation입니다.

## 개발 프로세스

### 정책을 먼저 고정한 이유

초기에는 FE 프로토타입 중심으로 진행했지만, 시즌·기숙사·프로필·매칭·탈퇴 정책이 서로 강하게 의존해 작은 기능 변경이 다른 도메인을 계속 뒤집었습니다. 그래서 Sprint 4 이후 구현을 멈추고 정책 문서를 정규화한 뒤, BE는 정책 owner에 맞춰 다시 설계했습니다.

대표적으로 다음 질문들은 코드보다 정책이 먼저 필요했습니다.

- registration 전 draft profile은 public search target인가?
- 미등록 viewer가 볼 수 있는 summary 범위는 어디까지인가?
- active matched target은 search discovery에서 제외할 것인가?
- 계정 삭제 후 과거 matched partner detail은 어떻게 degrade할 것인가?
- chat body와 profile/history snapshot은 어떤 retention tier에 둘 것인가?

### AI 활용 방식

| 영역          | 사람의 역할                                    | AI 활용                                        |
| ------------- | ---------------------------------------------- | ---------------------------------------------- |
| 요구사항·정책 | 정책 결정, 트레이드오프 선택, 범위 조정        | 대안 분석, 문서 초안, 누락 질문 도출           |
| 구현          | 아키텍처 판단, owner 경계 결정, 최종 diff 검토 | 반복 구현, 테스트 보강, regression 탐색        |
| QA            | 인수 조건 확정, 통과/불통과 판정               | 코드 리뷰, static guard, integration test 보강 |
| 문서          | 포트폴리오 방향성, 최종 메시지                 | 설계 근거 정리, stale 표현 탐색                |

핵심은 “AI가 대신 결정”이 아니라, AI가 만든 분석·코드를 정책 문서와 테스트로 검증하고 사람이 채택/반려를 판단하는 구조입니다.

## 개발 타임라인

| 구간               | 목표                                       | 핵심 산출물                                                                                                                              |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 0~3         | FE 프로토타입과 주요 사용자 흐름 확인      | landing/onboarding/main tab, mock 기반 auth/profile/matching flow                                                                        |
| Sprint 4~5         | 정책 충돌 정리                             | 공식 정책 문서 세트, ATDD/QA workflow, policy-driven issue 재배치                                                                        |
| Sprint 6           | FE↔BE 아키텍처와 운영 전제 정리            | Next.js auth BFF + NestJS API + PostgreSQL 방향 결정                                                                                     |
| Sprint 7 #191~#194 | BE 기반 도입                               | Prisma/Postgres, auth API, users/profile API, campus/dormitory/season API                                                                |
| Sprint 7 #195      | matching/search/detail/chat/retention 정렬 | SeasonParticipant adoption, public target policy, roommate-search manifest/cursor/score, match/chat lifecycle, RRPD retention foundation |

## 서비스 요약

KNU Roommate는 학교 이메일 인증을 통과한 사용자가 시즌별로 기숙사 배정과 생활패턴 프로필을 등록하고, 같은 조건의 룸메이트 후보를 탐색·대화·매칭할 수 있게 하는 서비스입니다.

- 가입과 시즌 registration은 분리한다.
- registration 전에는 프로필/기숙사 선택 draft를 준비한다.
- registration 완료 후 같은 기숙사 후보에 대해 상세/점수/action capability가 열린다.
- post-match에는 신규 action보다 결과 확인과 과거 이력 read를 우선한다.
- 탈퇴/비식별화된 사용자는 user-facing detail을 tombstone/minimal result로 degrade한다.

더 자세한 제품 설명은 [SERVICE.md](./SERVICE.md)를 참고합니다.

## 문서 구조

`docs/`는 Git으로 추적되는 repository source of truth입니다. 개인 분석, 과거 계획·리뷰와 포트폴리오 자료는 Git에서 제외되는 `local-docs/`에 둡니다.

| 문서군               | 역할                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `docs/policies/`     | auth, season, profile, roommate-search, matching, chat, retention 등 공식 정책 source of truth |
| `docs/architecture/` | 장기 유지하는 기술 결정, 설계 근거와 ADR                                                       |
| `docs/runbooks/`     | 반복 가능한 운영·관측·복구 절차                                                                |
| `docs/development/`  | 재사용 가능한 개발·테스트 troubleshooting                                                      |
| `.omx/plans/`        | 실행 중인 세션 단위 리팩토링·정합성 계획                                                       |

## 프로젝트 구조

```text
knu_roommate/
├── apps/
│   ├── web/             # Next.js frontend / auth BFF
│   └── api/             # NestJS backend
├── packages/
│   ├── shared/          # FE/BE shared zod contracts and domain constants
│   ├── eslint-config/   # shared ESLint config
│   └── tsconfig/        # shared TypeScript config
├── docs/                # local policy/planning/tech docs
├── docker-compose.dev.yml
├── SERVICE.md
└── README.md
```

## 시작하기

### 사전 요구사항

- Node.js `>=24 <25`
- pnpm `10.x`
- Docker / Docker Compose

### 개발 환경 실행

```bash
pnpm install

# 로컬 PostgreSQL 실행: 127.0.0.1:5432, knu_dev / knu_dev_password
pnpm db:up

# Prisma client 생성 및 schema 반영
pnpm api:prisma:generate
pnpm db:push
pnpm db:seed

# web + api 개발 서버
cp apps/web/.env.example apps/web/.env
pnpm dev
```

| 앱         | 기본 URL                      |
| ---------- | ----------------------------- |
| Web        | http://localhost:3000         |
| API        | http://localhost:4000         |
| PostgreSQL | `127.0.0.1:5432/knu_roommate` |

API 개발 기본값은 `apps/api/src/config/*.ts`에 정의되어 있어 개발 단계에서는 root `.env` 없이도 동작합니다. `NODE_ENV=production`에서는 DB URL, JWT secret, retention key, cursor/token HMAC secret을 환경변수로 명시해야 합니다.

### 자주 쓰는 검증 명령

```bash
pnpm shared:build
pnpm api:prisma:generate
pnpm api:typecheck
pnpm api:lint
pnpm --dir apps/api exec jest --watchman=false --runInBand
pnpm --dir apps/api test:integration -- --runInBand
pnpm --dir apps/web test
```
