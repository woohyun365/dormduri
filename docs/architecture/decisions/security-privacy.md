# Security and privacy 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-11-07
**확인 근거**: [#289](https://github.com/woohyun365/dormduri/issues/289)의 2026-11-02 Web 단계 처리자 범위 결정 댓글(data-privacy-secret의 `sec.privacy.landing-visit-analytics`: Landing 방문 통계 도입, 처리방침 공개 근거, 코드 자리), [#862의 DB 결정 기록 댓글](https://github.com/woohyun365/dormduri/issues/862#issuecomment-6708394110)(trust-authz-model의 `sec.trust.db-privilege-audit`: grant 표 하나와 앱 append-only 감사·pgAudit)
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
  INSERT·SELECT만, RRPD 열람 기록의 기한 폐기는 worker). DB 쪽은 pgAudit가 DDL·role class를 기본으로 남기고, 사람 LOGIN user와 master user는 모든 문장을 남긴다
  (`pgaudit.log = 'all'`). bind 값은 pgAudit와 statement log 모두 남기지 않는다. PostgreSQL log는 CloudWatch에 731일(2년)
  둔다. 사람 DB 계정의 권한 부여·변경·말소 내역(3년)과 break-glass 사용은 pgAudit log와 따로 전용 운영 이슈의 댓글로 남긴다
  ([권한 내역과 break-glass](../../../infra/db/README.md#권한-내역과-break-glass)). RRPD SELECT 객체 감사는 하지 않는다
- 근거: 앱이 쓰는 감사는 table 권한으로 고칠 수 없게 막고, DB에 직접 들어온 사람의 열람·변경은 pgAudit가 남긴다. 운영 worker의
  RRPD 읽기까지 객체 감사로 남기면 log 양과 비용이 크고 열람 판단은 `RetentionAccessLog`와 role 차단이 한다. bind 값을 남기면
  개인정보가 log로 흘러간다. master session은 pgAudit 설정을 끌 수 있어 접속·종료 log, break-glass 기록, 쓴 뒤 비밀번호
  교체로 보완한다
- 기각한 대안: RRPD SELECT 객체 감사(log 양·비용, 운영 worker 읽기까지 남음), 앱 감사만(DB에 직접 들어온 사람의 변경이 안
  남음), 사람은 쓰기·DDL·role만(누가 어떤 개인정보를 열람했는지 안 남음), log 1년 보존(관리자 접속·행위 기록 2년 기준과 다름)
- 재검토 조건: 관리자 감사 table을 만들 때, 사람 조회 경로가 SSM 밖으로 늘 때, pgAudit log 양이 CloudWatch 비용 기준을 넘을 때
- 출처: #239, #862, Owner 확인 2026-11-04
- pack 결정: 없음

## data-privacy-secret

이 절의 결정은 [operational-observability.md](../../policies/operational-observability.md)가 제품 분석 수집 전에 요구하는 별도
목적·보존·privacy 결정입니다.

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
