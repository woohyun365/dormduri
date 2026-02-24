# KNU Roommate

강원대학교(춘천캠퍼스) 기숙사 생활 패턴 기반 룸메이트 매칭 서비스

## 소개

기숙사 룸메이트는 학기 시작 전 배정되지만, 흡연 여부/수면 패턴/소음 민감도/청결 기준 등 생활 습관이 맞지 않으면 한 학기 내내 스트레스가 됩니다.

KNU Roommate는 `@kangwon.ac.kr` 이메일 인증을 통해 재학생임을 확인하고, 생활 패턴 설문을 기반으로 나와 맞는 룸메이트 후보를 탐색하고 매칭할 수 있는 시즌형 서비스입니다.

### 핵심 기능

- **학교 이메일 인증** — `@kangwon.ac.kr` 인증으로 재학생만 이용
- **생활 패턴 프로필** — 흡연, 취침/기상 시간, 소음 민감도, 청결 기준 등 구조화된 설문
- **필터 기반 탐색** — 하드 조건(흡연, 수면 시간대 등)으로 필터링 + 유사도 기반 정렬
- **매칭 요청/수락** — 후보에게 매칭 요청을 보내고, 상대가 수락하면 1:1 매칭 성사
- **시즌 운영** — 입사 시즌(1~2월, 7~8월)에만 매칭 기능 활성화, 비시즌에는 열람/준비 모드

### 운영 정책

| 항목          | 내용                                    |
| ------------- | --------------------------------------- |
| 동시 요청     | 최대 5명                                |
| 요청 만료     | 48시간 (무응답 시 자동 만료)            |
| 재요청 쿨다운 | 7일                                     |
| 매칭 방식     | 1인 1매칭 (성사 시 다른 요청 자동 취소) |

## 기술 스택

| 영역        | 기술                                                |
| ----------- | --------------------------------------------------- |
| Frontend    | Next.js 16 (App Router), React 19, TypeScript       |
| Backend     | NestJS, TypeScript                                  |
| Styling     | Tailwind CSS 4                                      |
| Monorepo    | pnpm workspace                                      |
| Lint/Format | ESLint (flat config), Prettier, Husky + lint-staged |

## 프로젝트 구조

```
knu_roomate/
├── apps/
│   ├── web/          # Next.js 프론트엔드
│   └── api/          # NestJS 백엔드
├── packages/
│   ├── eslint-config/  # 공유 ESLint 설정
│   └── tsconfig/       # 공유 TypeScript 설정
└── docs/             # 기획/참고 문서 (로컬 전용, gitignore)
```

## 시작하기

### 사전 요구사항

- Node.js 20+
- pnpm 9+

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 환경변수 설정
cp apps/web/.env.example apps/web/.env

# 개발 서버 실행 (web + api 동시)
pnpm dev
```

| 앱             | URL                                                   |
| -------------- | ----------------------------------------------------- |
| Web (Frontend) | http://localhost:3000                                 |
| API (Backend)  | http://localhost:3000 (NestJS 기본 포트 설정 후 변경) |

## 브랜치 컨벤션

```
main                    # 프로덕션
dev                     # 개발 통합
FE/<type>/<scope>       # 프론트엔드 작업
BE/<type>/<scope>       # 백엔드 작업
```

**타입**: `feat` | `fix` | `refactor` | `enhance` | `chore`
