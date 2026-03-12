# KNU Roommate Service Overview

## 한 줄 소개

KNU Roommate는 강원대학교 재학생이 기숙사 룸메이트를 더 예측 가능하게 찾을 수 있도록 돕는 생활패턴 기반 시즌형 매칭 서비스다.

## 어떤 문제를 푸는가

기숙사 룸메이트는 한 학기 생활 만족도에 큰 영향을 준다.
하지만 기존에는 단톡방, 커뮤니티, 지인 소개처럼 파편화된 채널에 의존해야 해서 다음 문제가 반복된다.

- 생활패턴 정보를 구조적으로 비교하기 어렵다.
- 흡연, 취침 시간, 소음 민감도, 청결 기준 같은 핵심 조건이 뒤늦게 드러난다.
- 재학생 인증, 신고, 차단 같은 기본 안전장치가 약하다.
- 학교 기숙사 운영 일정과 맞지 않는 방식으로 사람을 구하게 된다.

KNU Roommate는 이 문제를 "학교 이메일 인증 + 생활패턴 프로필 + 시즌 운영 + 건물 기반 매칭"으로 풀려고 한다.

## 누구를 위한 서비스인가

- 강원대학교 재학생
- 기숙사 입사를 준비 중인 사용자
- 생활 습관이 맞는 룸메이트를 미리 찾고 싶은 사용자

가입과 매칭 참여는 동일하지 않다.
가입은 재학생 인증으로 가능하지만, 실제 매칭 참여는 시즌과 건물 배정 입력 조건을 충족해야 한다.

## 서비스는 어떻게 동작하는가

### 1. 학교 이메일 기반 가입

사용자는 `@kangwon.ac.kr` 이메일 인증을 통해 가입한다.
서비스는 최소한의 신뢰 장치를 확보하되, 학교 시스템을 직접 연동하지는 않는다.

### 2. 생활패턴 프로필 작성

사용자는 자신의 생활패턴과 원하는 룸메 조건을 구조화된 형태로 입력한다.
서비스는 이 정보를 바탕으로 후보 탐색과 호환도 계산을 제공한다.

### 3. 시즌형 운영

서비스는 항상 같은 방식으로 동작하지 않는다.

- 비시즌: 같은 캠퍼스 기준 읽기 전용 탐색
- 시즌: 건물 배정 입력 완료 사용자끼리 매칭 기능 활성화

즉, 사용자는 비시즌에 미리 둘러보고 준비할 수 있고, 시즌에는 실제 매칭 행동을 할 수 있다.

### 4. 건물 기반 매칭

이 서비스에서 건물 정보는 선호 입력이 아니라 학교 배정 결과 입력이다.
시즌에는 같은 건물에 배정된 사용자끼리만 매칭 풀을 구성한다.

### 5. 대화 후 확정

서비스는 프로필 열람만으로 바로 매칭을 확정시키지 않는다.
요청, 대화, 확정이라는 단계를 두어 성급한 결정과 오해를 줄이는 방향으로 설계한다.

## 핵심 사용자 경험

- 생활패턴이 맞는 후보를 구조적으로 탐색할 수 있다.
- 시즌과 자격 조건에 따라 가능한 행동이 명확하게 나뉜다.
- 같은 건물 배정 사용자 중심으로 더 현실적인 매칭 풀을 만든다.
- 신고, 차단, 콘텐츠 가이드로 기본적인 안전 장치를 제공한다.

## 이 서비스의 차별점

이 프로젝트는 단순한 "프로필 리스트 + 좋아요" 서비스가 아니다.
다음처럼 정책이 제품 동작을 직접 결정한다.

- 시즌과 비시즌에 따라 기능이 달라진다.
- 건물 배정 입력이 매칭 자격과 직결된다.
- 프로필 필드마다 노출 범위와 수정 가능 범위가 다르다.
- 매칭은 요청, 대화, 확정 같은 상태 전이를 가진다.
- 공개 페이지 카피도 실제 운영 정책과 맞아야 한다.

그래서 이 서비스의 핵심은 화면 수보다도, 정책을 일관된 제품 동작으로 옮기는 설계에 있다.

## 서비스가 보장하는 것과 보장하지 않는 것

서비스는 생활패턴 기반 탐색, 대화, 매칭 관리 경험을 제공한다.
하지만 다음은 보장하지 않는다.

- 호실 선택 성공
- 프로필 내용의 절대적 진실성
- 외부 채널에서의 합의 결과
- 학교 시스템 일정이나 권한 자체

즉, KNU Roommate는 룸메이트 탐색과 합의 과정을 돕는 서비스이지,
학교 기숙사 배정 시스템을 대체하는 서비스는 아니다.

## 현재 문서 구조에서의 위치

- [`README.md`](./README.md): 저장소 소개와 빠른 진입용 문서
- `SERVICE.md`: 현재형 서비스 소개 문서
- [`docs/04_policy/official/README.md`](./docs/04_policy/official/README.md): 구현 기준 공식 정책 세트
- [`docs/00_archive/01_development/PRD.md`](./docs/00_archive/01_development/PRD.md): 초기 기획 아카이브

## 자세한 정책 문서

세부 운영 규칙은 아래 문서를 기준으로 본다.

- [`docs/04_policy/official/account-authentication.md`](./docs/04_policy/official/account-authentication.md)
- [`docs/04_policy/official/access-eligibility.md`](./docs/04_policy/official/access-eligibility.md)
- [`docs/04_policy/official/season-lifecycle.md`](./docs/04_policy/official/season-lifecycle.md)
- [`docs/04_policy/official/profile-model.md`](./docs/04_policy/official/profile-model.md)
- [`docs/04_policy/official/matching-lifecycle.md`](./docs/04_policy/official/matching-lifecycle.md)
- [`docs/04_policy/official/service-boundary.md`](./docs/04_policy/official/service-boundary.md)
- [`docs/04_policy/official/community-safety.md`](./docs/04_policy/official/community-safety.md)
