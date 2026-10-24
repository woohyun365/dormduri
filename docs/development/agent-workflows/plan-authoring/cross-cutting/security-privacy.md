# Security and privacy plan lens

Auth, legal, PII, profile/chat, moderation, abuse, analytics 또는 observability payload가 범위에 포함될 때 primary domain
guide와 함께 읽습니다. 일반 기능마다 자동 선택하지 않습니다.

## Required analysis

- actor, identity and trust boundary
- consent and audit owner

구현·리뷰 기준: [web-security-privacy-trust-authz-model.md P1](../../review-criteria/web-security-privacy-trust-authz-model.md#p1-cookie-인증-상태-변경-요청의-cross-site-위조-방지), [web-security-privacy-trust-authz-model.md P2](../../review-criteria/web-security-privacy-trust-authz-model.md#p2-서버-쪽-인가와-객체-단위-권한), [web-security-privacy-trust-authz-model.md P3](../../review-criteria/web-security-privacy-trust-authz-model.md#p3-열거추측재전송빈도-남용-방어), [web-security-privacy-trust-authz-model.md P4](../../review-criteria/web-security-privacy-trust-authz-model.md#p4-주입xssopen-redirect), [web-security-privacy-trust-authz-model.md P5](../../review-criteria/web-security-privacy-trust-authz-model.md#p5-신고차단제재의-오탐과-이의), [web-security-privacy-data-privacy-secret.md P1](../../review-criteria/web-security-privacy-data-privacy-secret.md#p1-숨긴-신원비공개-필드의-공개-범위-유지), [web-security-privacy-data-privacy-secret.md P2](../../review-criteria/web-security-privacy-data-privacy-secret.md#p2-데이터-분류와-수집전달-최소화), [web-security-privacy-data-privacy-secret.md P3](../../review-criteria/web-security-privacy-data-privacy-secret.md#p3-보존-목적기한삭제비식별), [web-security-privacy-data-privacy-secret.md P4](../../review-criteria/web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제), [web-security-privacy-data-privacy-secret.md P5](../../review-criteria/web-security-privacy-data-privacy-secret.md#p5-외부-처리자와-법적-근거의-현재성)

## Plan additions

- threat/abuse cases and prohibited outcomes
- data-flow and disclosure matrix
- security/privacy Decisions and blocking OQs
- server-side enforcement owner; UI-only gating is insufficient
- negative tests for unauthorized actor, stale/replayed input, sensitive leakage and enumeration
- release evidence handoff for account/region/retention values unavailable during repository implementation

보안을 이유로 unrelated abstraction이나 provider를 자동 도입하지 않습니다. Risk와 current control gap을 먼저
증명하고 가장 작은 owner-local control을 계획합니다.

구현·리뷰 기준: [web-security-privacy-trust-authz-model.md P2](../../review-criteria/web-security-privacy-trust-authz-model.md#p2-서버-쪽-인가와-객체-단위-권한), [web-security-privacy-trust-authz-model.md P3](../../review-criteria/web-security-privacy-trust-authz-model.md#p3-열거추측재전송빈도-남용-방어), [web-security-privacy-data-privacy-secret.md P2](../../review-criteria/web-security-privacy-data-privacy-secret.md#p2-데이터-분류와-수집전달-최소화), [web-operations-release-release-gate.md O1](../../review-criteria/web-operations-release-release-gate.md#o1-release-handoff와-증거-없는-go-금지)
