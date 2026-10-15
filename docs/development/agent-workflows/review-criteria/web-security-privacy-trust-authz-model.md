# Web security-privacy trust and authorization model criteria

[Review criteria](./README.md)의 `web-security-privacy-trust-authz-model` 기준입니다. 요청의 신뢰 경계와 권한 판정을 바꾸는
변경에 적용합니다. 지금은 cookie 인증 상태 변경 요청의 위조 방지 항목만 있고, 나머지 항목은 이 영역을 바꾸는 변경 전에
더합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 강화만 합니다. 강화 관계는 P1 →
[swe.md S3](./swe.md#s3-정확성과-오류-경로)입니다. [web-bff-session-cookie-auth](./web-bff-session-cookie-auth.md)가 P1을
상속합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### P1. cookie 인증 상태 변경 요청의 cross-site 위조 방지

- 질문: cookie로 인증하는 상태 변경 요청을 server가 출처를 명시적으로 검사해 cross-site 위조 요청을 거부하는가?
- 기본 severity: `high`
- 적용 조건: cookie 인증을 쓰는 상태 변경 요청(POST·PUT·PATCH·DELETE)의 진입점을 더하거나 바꾸는 변경
- 결함 패턴: SameSite 속성이나 전달 helper만으로 위조 방어가 된다고 봄, 출처 검사 없이 상태 변경 요청을 받음, GET 요청으로 상태를 바꿈, 검사가 일부 진입점에만 있음
- PASS 근거: 상태 변경 진입점마다 출처(Origin·Fetch Metadata header 등)나 위조 방지 token을 검사하는 위치가 있고, cross-origin 요청 거부 negative test가 있다
- 지침: cookie 인증 상태 변경 요청은 server가 출처를 명시적으로 검사하고 cross-origin 요청을 거부한다. cookie 속성은 보조 방어로만 센다. 상태 변경은 GET으로 하지 않는다
- 피함: SameSite만 믿기, 일부 진입점만 검사하기, GET으로 상태 바꾸기
