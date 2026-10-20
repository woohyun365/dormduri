## Summary

- Outcome: migration 오탈자를 고친다

## Related

- Development PR: Refs #634

## Lifecycle

<!-- 이 fixture는 run.mjs local 실행과 test가 쓴다. -->

- 변경 등급: bugfix
- 등급 근거: 배포 전 migration의 column 이름 오탈자
- 정책 도메인: production-runtime-safety
- 인용 규칙: [production-runtime-safety.md PRS-R1](docs/policies/production-runtime-safety.md)
- override: W-IRREV — 배포 전 migration 오탈자 수정 — 다음 migration PR

## Changes

migration SQL 한 줄
