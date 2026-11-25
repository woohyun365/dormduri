# Security and privacy 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-11-25
**확인 근거**: [#289](https://github.com/woohyun365/dormduri/issues/289)의 2026-11-02 Web 단계 처리자 범위 결정 댓글(data-privacy-secret의 `sec.privacy.landing-visit-analytics`: Landing 방문 통계 도입, 처리방침 공개 근거, 코드 자리), [#862의 DB 결정 기록 댓글](https://github.com/woohyun365/dormduri/issues/862#issuecomment-6708394110)(trust-authz-model의 `sec.trust.db-privilege-audit`: grant 표 하나와 앱 append-only 감사·pgAudit), [#869의 log 보존 결정 댓글](https://github.com/woohyun365/dormduri/issues/869#issuecomment-6718939243)(data-privacy-secret의 `sec.privacy.log-retention`: log 종류별 보존과 IP 가림, 통신비밀보호법 적용 시점), [#869의 접속 log 필드 결정 댓글](https://github.com/woohyun365/dormduri/issues/869#issuecomment-6719267639)(같은 항목의 `OO-R1`), [#949의 결정 기록 댓글](https://github.com/woohyun365/dormduri/issues/949#issuecomment-7059715410)(trust-authz-model의 `sec.trust.db-privilege-audit`: 관리자 감사의 폐기 주체 `backoffice_retention`, data-privacy-secret의 `sec.privacy.log-retention`: 백오피스 앱 감사 3년과 pgAudit·SSM 기록 2년, 2026-11-12·21), [#958의 결정 기록 근거 댓글](https://github.com/woohyun365/dormduri/issues/958#issuecomment-7064557164)(trust-authz-model의 `sec.trust.authz-model/backoffice`·`sec.trust.admin-authentication`·`sec.trust.separation-of-duties`와 `sec.trust.db-privilege-audit`의 감사 시각, 2026-11-04·12·21), [#1000의 결정 기록 근거 댓글](https://github.com/woohyun365/dormduri/issues/1000#issuecomment-7164201580)(trust-authz-model의 `sec.trust.separation-of-duties`: 법적 문서 승인과 승인 종류마다의 비활성화 거부, 2026-11-25)
**근거**: [공개 법적 문서 fallback](../../../apps/web/src/legal/content/legal-fallback-documents.ts), [Web 운영 관측성 경계](../frontend/web-observability.md), [지금 운영 환경](../../deploy/production-environment.md), [Domain/SWE/Web/security-privacy pack](../../development/agent-workflows/domain/swe-web/security-privacy.md)

`Domain/SWE/Web/security-privacy` pack layer의 결정 기록입니다. 형식과 상태 어휘는 [Decision records](./README.md)입니다.

## trust-authz-model

DB 계정·grant는 [Database operator scripts](../../../infra/db/README.md#credential-boundary)가, 접속 기록 parameter는
[RDS setup and backup checklist](../../../infra/aws/rds-setup-checklist.md#parameter-group)가 소유합니다.

#### sec.trust.db-privilege-audit

- 판정: Ask
- 상태: validated
- 고른 선택지: DB 권한은 grant 표 하나(`packages/database/prisma/role-grants/role-grant-matrix.csv`)가 table마다 허용·거부의
  원본이고, apply와 smoke가 같은 표를 읽는다. 관리자 행위·RRPD 열람 감사는 앱의 append-only table에 남긴다(앱에서 기록하는 role은
  INSERT·SELECT만. 기한 폐기는 RRPD 열람 기록이 worker, 관리자 감사가 백오피스 host에만 credential이 있는 `backoffice_retention`이고,
  사용자 API credential은 관리자 감사에 닿지 않는다). DB 쪽은 pgAudit가 DDL·role class를 기본으로 남기고, 사람 LOGIN user와 master user는 모든 문장을 남긴다
  (`pgaudit.log = 'all'`). bind 값은 pgAudit와 statement log 모두 남기지 않는다. 관리자 감사 시각은 DB 시계만 쓴다(`backoffice_runtime`은 `occurredAt`을 뺀 열에만 INSERT 권한이 있다). PostgreSQL log는 CloudWatch에 731일(2년)
  둔다. 사람 DB 계정의 권한 부여·변경·말소 내역(3년)과 break-glass 사용은 pgAudit log와 따로 전용 운영 이슈의 댓글로 남긴다
  ([권한 내역과 break-glass](../../../infra/db/README.md#권한-내역과-break-glass)). RRPD SELECT 객체 감사는 하지 않는다
- 근거: 앱이 쓰는 감사는 table 권한으로 고칠 수 없게 막고, 권한과 무관하게 감사 행을 지우거나 고치는 부모 삭제·id 변경의 FK
  경로도 `Restrict`로 막는다(#868, [db.integrity.audit-tables](./db.md#dbintegrityaudit-tables)). DB에 직접 들어온 사람의 열람·변경은
  pgAudit가 남긴다. 운영 worker의
  RRPD 읽기까지 객체 감사로 남기면 log 양과 비용이 크고 열람 판단은 `RetentionAccessLog`와 role 차단이 한다. bind 값을 남기면
  개인정보가 log로 흘러간다. master session은 pgAudit 설정을 끌 수 있어 접속·종료 log, break-glass 기록, 쓴 뒤 비밀번호
  교체로 보완한다. 관리자 감사 폐기 권한을 사용자 API worker에 두면 공개 ingress 뒤 process가 뚫렸을 때 3년이 안 된 관리자 기록도
  지울 수 있어(grant는 행의 나이를 막지 못함) 백오피스 host로 둔다. user host가 host 수준으로 뚫리면 배포 one-off의 migration
  credential(모든 객체의 소유자)은 결정과 무관하게 모든 table에 닿으므로 RDS 백업·시점 복원과 pgAudit DDL·role 기록이 대응이다
- 기각한 대안: RRPD SELECT 객체 감사(log 양·비용, 운영 worker 읽기까지 남음), 앱 감사만(DB에 직접 들어온 사람의 변경이 안
  남음), 사람은 쓰기·DDL·role만(누가 어떤 개인정보를 열람했는지 안 남음), log 1년 보존(pgAudit·SSM 기록 2년, 백오피스 앱 감사 3년보다 짧음), 관리자 감사 폐기를 사용자 API worker로(사용자 API process 침해 때 관리자 기록에 닿음)
- 이전 선택: 2026-11-04 관리자 행위 감사의 폐기 주체를 정하지 않음(관리자 감사 table 없음). 바꾼 이유: 관리자 감사 table을 만듦(재검토
  조건). 출처 #949, Owner 확인 2026-11-21
- 재검토 조건: 사람 조회 경로가 SSM 밖으로 늘 때, pgAudit log 양이 CloudWatch 비용 기준을 넘을 때, 백오피스 host에 공개 ingress가 생길 때
- 출처: #239, #862, #949, #958, Owner 확인 2026-11-04·2026-11-21
- pack 결정: 없음

#### sec.trust.authz-model/backoffice

- 판정: Ask
- 상태: validated
- 고른 선택지: 선택지 밖: 역할 묶음 + 세부 권한. 세부 권한(`admin:<자원>:<행동>`)은 `@repo/shared/backoffice`에, 역할 묶음은 백오피스 API
  code에 고정하고 DB에는 계정별 역할 부여(`AdminRoleAssignment`)만 둔다. 세션의 권한은 활성 역할에서 계산하고 전역 guard가 route마다
  선언한 권한과 대조한다(규칙이 없는 route는 거부). 제한 권한(`admin:restricted:*`)은 어느 역할에도 없다(`OA-R11`). 역할 부여·회수는
  승인 요청을 거친다(`OA-R9`)
- 근거: 운영자가 몇 명이고 관리자 기능이 다루는 대상은 운영자 계정·승인 요청·감사라 사용자별 data 소유 관계가 없다. 대상 확인은
  업무 code가 한다(자기 비활성화 거부, 요청자만 취소, 결정자 ≠ 요청자). 역할 밖 조합이 필요하면 역할을 더한다. 모든 route의 규칙은
  route 전수 표 test가 고정한다. 역할과 권한 상수를 바꾸는 비용은 크지 않지만 모든 route의 판정과 test를 다시 본다
- 기각한 대안: 계정마다 세부 권한 직접 부여(권한 조합이 계정마다 흩어져 점검이 어렵다), 구분 없는 관리자(제5조 제1항의 차등 부여에
  어긋난다), 화면 표시로만 막음(요청을 직접 보내면 막히지 않는다)
- 재검토 조건: 역할 밖 권한 조합이 세 번 넘게 필요할 때, RRPD 열람 기능이 제한 권한 역할을 만들 때, 사용자 개인정보를 다루는 백오피스
  화면이 생길 때(대상 단위 확인)
- 출처: #958, Owner 확인 2026-11-12
- pack 결정: [sec.trust.authz-model](../../development/agent-workflows/domain/swe-web/security-privacy.md#sectrustauthz-model)

#### sec.trust.admin-authentication

- 판정: Ask
- 상태: validated
- 고른 선택지: [operator-access.md](../../policies/operator-access.md) `OA-R2`~`OA-R5`. 관리자 계정은 사용자 계정과 분리하고 비밀번호와
  passkey(`@simplewebauthn/server`)를 모두 통과해야 로그인한다. TOTP(RFC 6238, `node:crypto` 직접 구현)·복구 code는 passkey 재등록 전용
  session만 연다
- 근거: passkey는 origin에 묶여 phishing에 강하고, 예비 수단이 관리자 권한을 열지 않으므로 TOTP·복구 code가 새어도 새 passkey 등록과
  로그아웃만 할 수 있다(그때마다 경보). 운영자 계정이 몇 개라 계정 잠금(5회·15분)과 process 안 빈도 제한으로 추측 시도를 막는다
- 기각한 대안: 비밀번호 + TOTP(phishing에 약하다), 외부 IdP SSO(처리위탁 고지가 늘고 운영자 한 명 규모에 무겁다), TOTP library 도입(RFC
  6238 test vector로 확인하는 짧은 code라 새 dependency를 들이지 않는다)
- 재검토 조건: 운영자가 백오피스를 SSM 포트 포워딩 밖에서 열 때, passkey를 쓸 수 없는 운영 환경이 생길 때
- 출처: #958, Owner 확인 2026-11-04·2026-11-12
- pack 결정: 없음

#### sec.trust.separation-of-duties

- 판정: Ask
- 상태: validated
- 고른 선택지: [operator-access.md](../../policies/operator-access.md) `OA-R9`~`OA-R11`. 역할 부여·회수, 법적 문서 게시·철회와
  RRPD 열람은 요청자와 다른 운영자가 결정하고, 승인 권한 계정이 요청자 하나뿐일 때만 재인증·사유·자기 승인 표시·경보로 자기 요청을
  승인한다(RRPD 열람은 근거 문서 번호도 필수). 첫 owner는 SSM 일회성 명령의 15분 1회용 code로 만든다
- 근거: 운영자가 한 명인 동안 예외가 없으면 첫 역할 부여와 법령상 요청 대응이 막힌다. 예외는 결정 때 승인 계정 수를 세어 둘째 승인
  계정이 생기면 저절로 꺼지고, 감사 표시와 월 점검(`OA-R8`)이 사후 확인한다. 승인 계정을 요청자 하나만 남기는 비활성화는 승인
  종류(역할 변경·법적 문서)마다 거부하고 그 역할을 승인 요청으로 먼저 회수하게 해(Owner 2026-11-22·2026-11-25) 한 운영자가 다른
  승인자를 비활성화해 예외를 다시 여는 길을 막는다. DB CHECK가 상태·결정자·자기 승인 표시의 짝을 지킨다
- 기각한 대안: 예외 없음(둘째 운영자 전에는 역할 부여와 RRPD 열람을 할 수 없다), 직무 분리 안 함(한 운영자가 자기 권한을 표시 없이
  넓힌다), 첫 계정을 seed나 환경변수로 만듦(배포 산출물에 관리자 credential이 남는다)
- 이전 선택: 2026-11-22 승인 계정을 요청자 하나만 남기는 비활성화 거부는 역할 변경 승인 계정만 셈. 바꾼 이유: 법적 문서 게시·철회
  승인이 이 틀에 붙어(재검토 조건 "legal 게시 승인이 이 틀에 붙을 때") 승인 계정을 `admin:legal:approve`를 가진 역할(`OWNER`·
  `LEGAL_APPROVER`)로 결정 때 세고, 직무 분리·1인 예외·비활성화 거부를 역할 변경과 같게 둠. 출처 #1000, Owner 확인 2026-11-25
- 재검토 조건: 운영자가 둘 이상이 될 때(예외는 자동으로 꺼짐), 승인 계정이 둘일 때 상대가 연락되지 않아 앱 안에서 그 역할을
  회수할 수 없을 때(앱 밖 처리 절차가 필요)
- 출처: #958, #1000, Owner 확인 2026-11-12·2026-11-21·2026-11-25
- pack 결정: 없음

## data-privacy-secret

`sec.privacy.landing-visit-analytics`는 [operational-observability.md](../../policies/operational-observability.md)가 제품 분석
수집 전에 요구하는 별도 목적·보존·privacy 결정입니다.

#### sec.privacy.landing-visit-analytics

- 판정: Ask
- 상태: validated
- 고른 선택지: Landing(`/`)에서만 Cloudflare Web Analytics를 JavaScript 코드 조각으로 불러온다(DNS·proxy 변경 없음, SPA 자동
  추적 끔, build 때 token이 없으면 script 없음). 목적은 Landing 방문 수·유입 경로·기기 분포와 체감 성능 확인이다. 수탁자는
  Cloudflare, Inc.(처리방침 제4조 위탁 표와 국외 이전 표)이고, 항목은 처리방침 제2조 "방문 통계" 행(방문한 페이지·참조 주소,
  접속 국가, 브라우저·기기·운영체제 종류, 화면 표시 성능 측정값. 접속 IP는 방문 통계 도구를 불러오는 요청과 방문 통계 전송에 실려 Cloudflare로 가고, Cloudflare는 방문 통계 전송의 접속 IP를 저장하지 않는다고 밝힘)과 같다. 보존은
  [data-retention.md DR-R2](../../policies/data-retention.md)가, 국외 이전 근거(처리방침 공개)는
  [legal-basis.md LB-R3](../../policies/legal-basis.md)가 소유한다. 거부는 외부 스크립트를 막는 콘텐츠 차단 기능(광고·추적 차단 확장 프로그램 등)이다(처리방침 제8조).
  코드는 `apps/web/src/screens/landing/components/LandingVisitAnalytics.tsx`, token은 `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`
  (build-public, optional)이다
- 근거: Cloudflare 공식 문서는 cookie·브라우저 저장소를 쓰지 않고 fingerprint하지 않으며 beacon의 접속 IP를 저장하지 않는다고 적는다.
  script를 받아 오는 요청의 접속 IP 처리는 공식 문장이 없어 처리방침은 그 IP를 저장하지 않는다고 적지 않는다.
  무료이고 DNS를 옮기지 않는다. 방문자 브라우저가 미국 법인 Cloudflare에 직접 전송하므로 보수적으로 위탁과 국외 이전 다섯 항목을
  처리방침에 공개했다. 고지와 코드가 같은 변경에 있어 고지 없는 처리가 생기지 않는다. 되돌림은 쉽다(token secret을 지우면 다음
  build부터 script가 빠진다). 이미 보낸 방문 data는 Cloudflare 보유 기준(DR-R2)을 따른다
- 기각한 대안: Landing 동의 배너(cookie 없는 통계에 비해 무겁고 Owner가 처리방침 공개를 골랐다), 방문 분석 보류, root layout에서
  불러옴(모든 route로 퍼진다), route 파일에서 렌더(Landing route 규칙이 바뀐다), Next.js third-party 패키지(새 dependency),
  runtime server env로 읽기(Landing이 build 때 static이라 dynamic 렌더 비용이 생긴다), Cloudflare proxy 자동 주입(DNS를
  Cloudflare로 옮겨야 한다)
- 재검토 조건: 방문 통계를 다른 route로 넓힐 때, Web에 CSP(`connect-src`·`script-src`)를 켤 때(beacon 주소를 넣지 않으면 전송이
  막힌다), Cloudflare가 수집 항목·보존·처리 위치를 바꿀 때, 실제 사용자 공개 전 법률·개인정보 전문가 검토 결과가 나올 때, 로그인
  뒤 화면이 Landing에서 client 이동으로 열릴 때
- 출처: #289, #290, Owner 확인 2026-10-30(도입)·2026-11-02(처리방침 공개 근거, 코드 자리)
- pack 결정: 없음

#### sec.privacy.log-retention

- 판정: Ask
- 상태: validated
- 고른 선택지: log를 종류별로 보존한다. Web·API·nginx 요청·앱 log는 운영 관측 저장소(Loki)에 30일 두고 그 저장소에는 가린 IP(IPv4
  /24·IPv6 /48)만 둔다([data-retention.md DR-R3](../../policies/data-retention.md)). 그 저장소로 보내는 접속 log 필드는
  [operational-observability.md OO-R1](../../policies/operational-observability.md)이 정한다. pgAudit와 SSM 세션 시작 기록(CloudTrail trail)은
  2년이고([data-retention.md DR-R4](../../policies/data-retention.md), [legal-basis.md LB-R7](../../policies/legal-basis.md)), 백오피스 앱의
  관리자 감사(접속·행위·권한 부여·회수 내역)는 한 table에 3년이다([data-retention.md DR-R5](../../policies/data-retention.md),
  [legal-basis.md LB-R9](../../policies/legal-basis.md)). 둘 다 2년 이상 기준을 채운다. 사람 DB 계정의 권한 부여·변경·말소 내역 3년은
  [sec.trust.db-privilege-audit](#sectrustdb-privilege-audit)와 같다. 통신비밀보호법은 적용 대상으로
  보고 이용자 간 통신(채팅)을 실제 사용자에게 여는 단계부터 로그기록·접속 IP를 3개월 보관하며, 그 전에는 운영 log 기준이다
  ([legal-basis.md LB-R8](../../policies/legal-basis.md)). nginx 접속 log의 분류는
  [Observability topology](../platform/observability-topology.md#접속-log-분류)가 소유한다
- 근거: [안전성 확보조치 기준 제8조](https://www.law.go.kr/LSW//admRulSideInfoP.do?admRulSeq=2100000265956&chrClsCd=010201&joNo=0008&joBrNo=00&dashNo=&docCls=jo&urlMode=admRulScJoRltInfoR)(원문 확인 2026-11-04)는 1년 이상이고 5만명 이상·민감정보 처리 시스템은 2년 이상이다. 민감정보가 들어올 수 있는
  채팅을 보수적으로 봐서 2년으로 둔다. [통신비밀보호법 시행령 제41조](https://www.law.go.kr/LSW//lsLinkCommonInfo.do?lspttninfSeq=121362&chrClsCd=010202)의 3개월은 전기통신사업자 의무이고
  [전기통신사업법 제2조제8호](https://www.law.go.kr/lsLawLinkInfo.do?lsJoLnkSeq=1000110976&chrClsCd=010202)는 신고가 면제된 경우를 포함한다(둘 다 원문 확인 2026-11-04). 채팅을 열기 전에는 보관할 이용자 간 통신이 없다. 장애 분석에 원본 IP와 경로 속 식별자가 필요하지 않고
  [운영 관측 정책](../../policies/operational-observability.md)은 raw IP·raw 식별자를 금지한다. 공개 처리방침은 원본 IP가 host json-file에
  있는 기간에도 사실이어야 해서 IP 가림과 30일을 운영 관측 저장소 기록에만 적는다
- 기각한 대안: 부가통신사업자 등록 시 적용으로 유보(신고 면제도 전기통신사업자에 포함), 관리자 접속기록 1년(민감정보가 들어올 수
  있는 채팅), Loki에 원본 IP 저장(운영 관측 정책의 raw IP 금지), 접속 log 경로를 그대로 Loki에 저장(raw 식별자 금지를 ingress log에서 포기), Web 요청 log를 크기 rotation만으로 두기(운영 관측 저장소의 시간
  기준이 없음)
- 이전 선택: 2026-11-04 관리자 접속·행위 기록과 pgAudit 2년. 바꾼 이유: 관리자 감사 table 하나가 접속·행위·권한 내역을 함께 담아 권한
  내역 최소 3년(안전성 확보조치 기준 제5조 제3항)에 맞춤(재검토 조건). 출처 #949, Owner 확인 2026-11-12(Q6·Q21)
- 재검토 조건: 채팅을 실제 사용자에게 열 때(3개월 저장 위치와 방식, 처리방침 보유 표), 사용자 개인정보를 다루는 백오피스 화면을 열 때
  (처리방침 보유 표의 접속 기록 줄을 3년·2년 구분에 맞춤), log 보존이 host disk를 넘을 때, 실제 사용자 공개 전 법률·개인정보 전문가 검토 결과가 나올 때
- 출처: #759, #869, #949, Owner 확인 2026-11-04(보존 기준)·2026-11-08(적용일, 접속 log 필드)·2026-11-12(관리자 감사 3년)
- pack 결정: 없음
