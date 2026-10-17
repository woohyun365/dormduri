# Domain/SWE/Web/security-privacy

[Domain/SWE/Web pack](./README.md)의 cross-cutting security-privacy layer입니다. 요청의 신뢰 경계와 권한 판정, 반복·추측 요청의
남용 방어와 입력의 주입 방어, 신고·차단·제재, 개인정보의 분류·보존·삭제와 비밀값·log 정제를 다룹니다. 다른 layer의 하위
layer는 그 기준 문서 머리말에 적은 이 layer의 항목을 상속합니다. 하위 layer마다 상속, 결정 목록, 구현 지침(기준 항목 인용),
검증 기준(항목 id), 위험, binding 키를 둡니다.

## trust-authz-model

`Domain/SWE/Web/security-privacy/trust-authz-model`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### sec.trust.authz-model

- 수준: `architecture-style`
- 질문: 누가 무엇을 할 수 있는지 어떤 모델로 판정할까?
- 선택지:
  - 행동별 허용(capability) + 대상 소유·관계 확인: server가 행동마다 허용 여부를 정하고 대상 객체의 소유·관계를 함께 확인한다. 같은 역할이어도 남의 data에 손대지 못하고 화면에 할 수 있는 행동을 알려 줄 수 있지만, 행동과 관계 규칙을 정의하고 test해야 한다
  - 역할(role)만: 사용자 역할로 판정한다. 단순하고 이해하기 쉽지만 같은 역할인 다른 사용자의 data를 구분하지 못한다. 대상 id로 사용자별 data에 접근하는 진입점이 있으면 연결된 기준 항목 `web-security-privacy-trust-authz-model.md P2`이 결함으로 본다
  - 화면 표시로만 막음: 권한 없는 버튼·메뉴를 숨긴다. code가 가장 적지만 요청을 직접 보내면 막히지 않는다. 연결된 기준 항목 `web-security-privacy-trust-authz-model.md P2`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `costly`. 모든 진입점의 판정과 test를 다시 쓴다
- 기본값: 행동별 허용 + 대상 소유·관계 확인. 같은 역할이어도 남의 data에 손대지 못하고, 화면이 할 수 있는 행동을 server가 알려 준다. 대상 id로 사용자별 data에 접근하는 진입점이 없는 작은 내부 도구면 역할만으로 시작한다
- 확인 단서: `{{binding:policy.account-authentication}}`, `{{binding:repo-structure.be-auth}}`의 guard(진입점 공통 판정)·capability 정의
- 기준 항목: [web-security-privacy-trust-authz-model.md P2](../../review-criteria/web-security-privacy-trust-authz-model.md#p2-서버-쪽-인가와-객체-단위-권한)

#### sec.trust.enforcement-point

- 수준: `code-pattern`
- 질문: 권한 판정을 code 어디에 둘까?
- 선택지:
  - 진입점 공통 guard + 대상 확인은 command·policy: 모든 진입점이 지나는 공통 판정(guard)이 인증과 행동 허용을 보고, 대상의 소유·관계 확인은 업무 code(command·policy)가 한다. 빠진 진입점이 생기지 않지만 두 곳이 맡을 판정을 나눠 정해야 한다
  - 진입점마다 손으로: 각 진입점이 직접 판정한다. 자유롭지만 판정이 흩어져 빠진 곳이 생긴다. 연결된 기준 항목 `web-security-privacy-trust-authz-model.md P2`이 결함으로 본다
  - 저장소 query 조건에만: 조회 조건에 사용자 조건을 넣어 대상을 거른다. 대상 확인이 data 접근과 붙어 있어 빠지기 어렵지만, 진입점에서 판정이 보이지 않아 검토와 test가 어렵다
- 먼저 정할 결정: `sec.trust.authz-model`
- 되돌림: `costly`. 진입점과 command 전체를 고친다
- 기본값: 진입점 공통 guard + command·policy의 대상 확인. 빠진 진입점이 생기지 않고 대상별 규칙은 업무 code가 가진다. framework가 진입점 공통 guard를 지원하지 않으면 공통 판정 helper를 진입점 첫 단계에서 부르고 빠진 진입점을 test로 찾는다
- 확인 단서: `{{binding:repo-structure.be-auth}}`의 guard, `{{binding:repo-structure.bff-helpers}}`, 다른 사용자 id로 접근하는 negative test
- 기준 항목: [web-security-privacy-trust-authz-model.md P2](../../review-criteria/web-security-privacy-trust-authz-model.md#p2-서버-쪽-인가와-객체-단위-권한)

#### sec.trust.abuse-throttle

- 수준: `operational`
- 질문: 반복·추측 요청의 빈도 제한을 어디서 셀까?
- 선택지:
  - 공유 저장소(DB·cache)에서 계정·대상별로: 모든 instance가 같은 저장소에서 센다. instance가 늘어도 한도가 지켜지고 주소를 바꾼 시도도 세지만 요청마다 저장소 조회가 늘어난다
  - 앞단 proxy에서 주소별로: 요청이 app에 닿기 전에 주소별로 센다. app code가 없고 instance가 함께 쓰는 한도지만, 주소를 바꾼 시도와 계정·대상별 남용은 세지 못한다
  - process 메모리: instance마다 메모리에서 센다. 가장 빠르고 단순하지만 instance마다 따로 세어 instance가 늘면 한도가 풀린다. instance가 둘 이상이거나 늘 수 있으면 연결된 기준 항목 `web-security-privacy-trust-authz-model.md P3`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 제한 위치를 옮긴다
- 기본값: 공유 저장소에서 계정·대상별. instance가 늘어도 같은 한도가 지켜지고 주소를 바꾼 시도도 센다. 공개 읽기 같은 단순 남용은 앞단 proxy 제한을 함께 쓴다
- 확인 단서: `{{binding:repo-structure.be-auth}}`의 빈도 제한 code와 instance 둘 이상 test
- 기준 항목: [web-security-privacy-trust-authz-model.md P3](../../review-criteria/web-security-privacy-trust-authz-model.md#p3-열거추측재전송빈도-남용-방어)

### 구현 지침

- [web-security-privacy-trust-authz-model.md P1](../../review-criteria/web-security-privacy-trust-authz-model.md#p1-cookie-인증-상태-변경-요청의-cross-site-위조-방지)
- [web-security-privacy-trust-authz-model.md P2](../../review-criteria/web-security-privacy-trust-authz-model.md#p2-서버-쪽-인가와-객체-단위-권한)
- [web-security-privacy-trust-authz-model.md P3](../../review-criteria/web-security-privacy-trust-authz-model.md#p3-열거추측재전송빈도-남용-방어)
- [web-security-privacy-trust-authz-model.md P4](../../review-criteria/web-security-privacy-trust-authz-model.md#p4-주입xssopen-redirect)
- [web-security-privacy-trust-authz-model.md P5](../../review-criteria/web-security-privacy-trust-authz-model.md#p5-신고차단제재의-오탐과-이의)

### 검증 기준

- `web-security-privacy-trust-authz-model.md P1`
- `web-security-privacy-trust-authz-model.md P2`
- `web-security-privacy-trust-authz-model.md P3`
- `web-security-privacy-trust-authz-model.md P4`
- `web-security-privacy-trust-authz-model.md P5`

### 위험

- 출처 검사 없는 cookie 인증 상태 변경(P1), 화면에서만 막은 권한과 대상 소유 확인이 빠진 진입점(P2), 응답 차이로 드러나는 대상 존재와 instance마다 따로 세는 빈도 제한(P3), 문자열로 이은 query·명령과 받은 URL로의 redirect(P4), 되돌릴 수 없는 자동 제재와 신고자 노출(P5)
- 비가역 선택: `sec.trust.authz-model`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴). `sec.trust.enforcement-point`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.be-auth}}`: server의 인증·권한 판정(guard·capability)과 보안 공통 code의 위치
- `{{binding:repo-structure.bff-helpers}}`: BFF 공통 helper(출처 검사 포함)의 위치
- `{{binding:repo-structure.server-session}}`: server 쪽 session 읽기와 요청 진입 middleware의 위치
- `{{binding:policy.account-authentication}}`: 인증·권한 정책 원본

## data-privacy-secret

`Domain/SWE/Web/security-privacy/data-privacy-secret`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### sec.privacy.classification-source

- 수준: `policy`
- 질문: 데이터 분류(공개·비공개·민감)의 원본을 어디에 둘까?
- 선택지:
  - 정책 문서의 분류 표: 제품·법 판단과 함께 한 곳에 둔다. 사람이 읽고 고치기 쉽고 code·schema가 그 표를 인용하지만, code와 표가 어긋나는지는 리뷰로 봐야 한다
  - schema field 표시: data 정의 옆에 분류를 적는다. 검사 도구가 읽을 수 있지만 정책 판단과 떨어져 있어 정책 원본과 어긋날 수 있다
  - code 상수: code에 분류 목록을 둔다. test가 바로 쓸 수 있지만 정책을 바꿀 때마다 code를 고쳐야 하고 정책 원본과 어긋날 수 있다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 분류 원본을 옮긴다
- 기본값: 정책 문서의 분류 표. 제품·법 판단이 한 곳에 모이고 code·schema는 그 표를 인용한다. schema 표시는 검사 도구가 생기면 보조로 더한다. 값은 정책이 소유한다
- 확인 단서: `{{binding:policy.index}}`, schema의 민감 field 표시
- 기준 항목: [web-security-privacy-data-privacy-secret.md P2](../../review-criteria/web-security-privacy-data-privacy-secret.md#p2-데이터-분류와-수집전달-최소화)

#### sec.privacy.deletion-mode

- 수준: `policy`
- 질문: 보존 기한이 지나거나 탈퇴하면 data를 지울까 익명화할까?
- 선택지:
  - 물리 삭제: 저장소에서 지운다. 남길 이유가 없는 정보를 갖지 않지만 통계·분쟁 확인에 쓸 기록도 사라진다
  - 익명화 뒤 보존: 사람을 알아볼 수 있는 값을 지우고 나머지를 남긴다. 통계·분쟁 기록을 쓸 수 있지만 남은 필드 조합으로 다시 식별되지 않게 관리해야 한다
  - 표시만 삭제(soft delete): 지웠다는 표시만 하고 값을 남긴다. 되살리기 쉽지만 개인정보가 그대로 남는다. 보존 기한이 지난 개인정보를 그대로 남기면 연결된 기준 항목 `web-security-privacy-data-privacy-secret.md P3`이 결함으로 본다
- 먼저 정할 결정: `sec.privacy.classification-source`
- 되돌림: `one-way`. 지운 data와 익명화한 data는 되살릴 수 없다
- 기본값: 개인정보는 물리 삭제하고, 통계·분쟁 기록처럼 남길 근거가 있는 것만 익명화한다. 남길 이유가 없는 정보를 갖지 않는다. 법적 보존 의무가 있으면 그 기간만 분리 보관한다. 값은 정책이 소유한다
- 확인 단서: `{{binding:policy.data-retention}}`, `{{binding:repo-structure.be-privacy}}`의 삭제·익명화 code
- 기준 항목: [web-security-privacy-data-privacy-secret.md P3](../../review-criteria/web-security-privacy-data-privacy-secret.md#p3-보존-목적기한삭제비식별)

#### sec.privacy.log-redaction

- 수준: `code-pattern`
- 질문: log·오류 보고에서 민감 값을 어떻게 뺄까?
- 선택지:
  - 기록할 필드만 허용(allowlist): 정한 필드만 기록한다. 새 필드가 생겨도 기본으로 빠지지만, 필요한 필드는 목록에 더해야 보인다
  - 금지 필드만 가림(denylist): 위험한 필드만 지운다. 기존 log를 크게 바꾸지 않고 한 곳에서 관리하지만, 목록에 없는 새 민감 필드는 기록될 수 있다
  - 기록하는 곳마다 수동: 기록하는 code마다 직접 뺀다. 자유롭지만 정제가 흩어져 빠진 곳이 생긴다. 연결된 기준 항목 `web-security-privacy-data-privacy-secret.md P4`이 결함으로 본다
- 먼저 정할 결정: `sec.privacy.classification-source`
- 되돌림: `easy`. 정제 helper를 바꾼다
- 기본값: 기록할 필드만 허용. 새 필드가 생겨도 기본으로 빠진다. 기존 log가 많아 바로 바꾸기 어려우면 금지 필드 가림에서 시작해 옮긴다
- 확인 단서: `{{binding:repo-structure.be-privacy}}`의 log 정제 code, log 출력 test
- 기준 항목: [web-security-privacy-data-privacy-secret.md P4](../../review-criteria/web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제)

### 구현 지침

- [web-security-privacy-data-privacy-secret.md P1](../../review-criteria/web-security-privacy-data-privacy-secret.md#p1-숨긴-신원비공개-필드의-공개-범위-유지)
- [web-security-privacy-data-privacy-secret.md P2](../../review-criteria/web-security-privacy-data-privacy-secret.md#p2-데이터-분류와-수집전달-최소화)
- [web-security-privacy-data-privacy-secret.md P3](../../review-criteria/web-security-privacy-data-privacy-secret.md#p3-보존-목적기한삭제비식별)
- [web-security-privacy-data-privacy-secret.md P4](../../review-criteria/web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제)
- [web-security-privacy-data-privacy-secret.md P5](../../review-criteria/web-security-privacy-data-privacy-secret.md#p5-외부-처리자와-법적-근거의-현재성)

### 검증 기준

- `web-security-privacy-data-privacy-secret.md P1`
- `web-security-privacy-data-privacy-secret.md P2`
- `web-security-privacy-data-privacy-secret.md P3`
- `web-security-privacy-data-privacy-secret.md P4`
- `web-security-privacy-data-privacy-secret.md P5`

### 위험

- 숨긴 값의 재조회·cache·log(P1), 분류 없이 더한 필드와 목적 밖 수집·전달(P2), 표시만 바꾼 삭제와 사본에 남은 원래 값(P3), 저장소·log·오류 보고에 남은 비밀값·token·개인정보(P4), 확인 없이 외부 provider로 보낸 개인정보(P5)
- 비가역 선택: `sec.privacy.deletion-mode`(`one-way`)
- 사람 승인 지점: 운영 data에 되돌릴 수 없는 삭제·익명화를 실행할 때는 agent가 대상 범위와 실행 계획까지 만들고 사람이 승인한 뒤 실행한다(P3)

### binding 키

- `{{binding:repo-structure.be-privacy}}`: 개인정보 처리·보존 실행과 관측 정제 code의 위치
- `{{binding:repo-structure.secret-delivery}}`: 배포 때 비밀값·설정을 실행 환경에 넣는 script와 설정의 위치
- `{{binding:policy.index}}`: 정책 문서 색인(데이터 분류의 원본)
- `{{binding:policy.data-retention}}`: 보존·삭제 정책 원본
