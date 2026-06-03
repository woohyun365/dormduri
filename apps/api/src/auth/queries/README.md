# Auth queries

Phase 8 first-pass responsibility refactor keeps existing read behavior in compatibility facades where moving it would create unnecessary behavior churn.

Future query providers should live here when they own read-only auth projections such as current-session lookup, actor context resolution, signup draft validation, or user eligibility checks. Do not put Prisma mutations or security-event side effects in this directory.
