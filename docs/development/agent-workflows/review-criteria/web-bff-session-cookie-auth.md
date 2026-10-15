# Web BFF session and cookie auth criteria

[Review criteria](./README.md)의 `web-bff-session-cookie-auth` 기준입니다. BFF의 session·token cookie 발급·갱신·삭제와
browser의 token 보관을 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 security-privacy 항목
[web-security-privacy-trust-authz-model.md P1](./web-security-privacy-trust-authz-model.md#p1-cookie-인증-상태-변경-요청의-cross-site-위조-방지)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 B1 → [swe.md S2](./swe.md#s2-제품-정책-부합), B2 →
[swe.md S3](./swe.md#s3-정확성과-오류-경로)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### B1. cookie 속성과 token 보관

- 질문: 인증 cookie가 script 접근 차단·HTTPS 전용·SameSite·host 한정 속성을 갖고, token을 browser script가 읽을 수 있는 곳에 두지 않는가?
- 기본 severity: `high`
- 적용 조건: session·token cookie의 발급·갱신·삭제, browser의 token 보관을 바꾸는 변경
- 결함 패턴: HttpOnly·Secure·SameSite·host 한정이 빠진 인증 cookie를 발급함, token을 browser 저장소나 browser로 가는 JSON 응답에 둠, 환경별 cookie 이름·속성이 인증 정책과 다름, logout이 cookie를 지우지 않음
- PASS 근거: cookie 속성을 인증 정책 원본과 대조하는 test가 있고, browser 응답과 저장소에 token이 없다는 test가 있다
- 지침: cookie 이름·속성 값은 저장소의 인증 정책 원본을 따르고 발급·삭제를 한 helper에서 한다. token은 server가 다루는 cookie에만 둔다
- 피함: token을 script가 읽는 저장소에 두기, cookie 속성을 route마다 따로 쓰기

### B2. session 갱신 위치

- 질문: session 갱신·삭제가 요청 진입 지점에서 일어나고, 화면 render·data 읽기 경로는 cookie를 쓰지 않는가?
- 기본 severity: `medium`
- 적용 조건: session·token의 갱신·삭제 경로, 요청 진입 middleware를 바꾸는 변경
- 결함 패턴: 화면 render나 server read 중에 cookie를 갱신해 응답과 화면 identity가 어긋남, 갱신 실패 뒤에도 화면이 login 상태로 남음, 여러 요청이 동시에 갱신해 token이 덮임
- PASS 근거: 갱신 위치가 요청 진입 지점 하나이고, 갱신 실패와 동시 갱신 경로를 실행하는 test가 있다
- 지침: 갱신은 요청 진입 지점(middleware·route)에서 하고 render·read 경로는 session을 읽기만 한다. 갱신이 실패하면 login 해제 경로로 보낸다
- 피함: render 중 cookie 쓰기, 갱신 위치를 여러 곳에 두기
