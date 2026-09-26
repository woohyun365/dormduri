# Independent lane and child task contract

One task has one write owner. Delegation is optional and advisory, not an automatic child spawn. A Lead retains assignment, scope changes, integration, final QA and stop/escalation decisions. A fresh independent reviewer receives source and acceptance criteria, not the builder's reasoning. Findings are hypotheses until reproduced. [Owner–Lead collaboration](../owner-lead-collaboration.md) governs communication.

Use the current host [adapter index](../adapters/README.md) for role, model, effort, admission, runtime and lifecycle details. The [Codex/OMX child policy](../adapters/codex-delegation.md) owns the existing `recommendDelegation()` schema and implementation; it does not define Claude parameters.

## Single-first gate

Use zero child lanes for a direct or deterministic answer, unresolved authority/ambiguity, dependent tasks, overlapping write ownership, or a lane without independent value and source-bound verification. A bounded independent read/review lane can be useful even with one child. Do not fan out merely to use available agents.

## Independence predicate

A lane is independent only when its bounded objective, read scope, write owner, expected output, verification and stop/handoff conditions can be completed without a sibling's result. Read-only lanes may inspect the same source. Dependent policy → contract → implementation work is sequential. The Lead checks current host capability before any dispatch.

## Candidate schema

A shared task/QA handoff identifies objective, source snapshot, allowed evidence/tools, read and write scope, non-goals, prohibited assumptions, expected result, verification, stop condition and Lead ownership. These fields do not imply a provider role or model. See the [Codex candidate schema](../adapters/codex-delegation.md#candidate-schema) for Codex-only `modelRequest`, Pass 2 and role data.

## Model recommendation

There is no shared model or effort default. [Codex model recommendation](../adapters/codex-delegation.md#model-recommendation) is a host adapter policy; Claude selection remains unqualified until its own adapter is implemented and validated.

## Context delivery

Pass the minimum complete source-bound packet. Preserve known failures and constraints; do not pass the builder's reasoning to an initial independent reviewer. Reuse requires current snapshot and ownership checks. Host fork, reuse and explicit-effort behavior is [Codex-specific](../adapters/codex-delegation.md#context-delivery); a common packet does not apply it.

## Role and effort

Role and effort are host-specific. [Codex routing](../adapters/codex-delegation.md#role-and-effort) and [Claude Code guidance](../adapters/claude-code.md) must be checked against their live host before use. Prompt labels do not grant capability.

## Count와 write policy

Single-first and one writer are shared constraints. Use only justified independent lanes and honor the active host's cap. The [Codex fan-out limits](../adapters/codex-delegation.md#count와-write-policy) are not silently inherited by Claude.

## Ownership boundary

The child returns evidence, gaps and blockers to the Lead. It cannot change assignment, approval, write scope, or claim final completion. Intake, common packet validation and host-specific recommendations are advisory; none of them launches a child or grants provider permission.

### Recovery child context

A recovery attempt requires a new bounded decision, current snapshot, failure evidence and the same owner/scope boundary. [Codex recovery child context](../adapters/codex-delegation.md#recovery-child-context) defines Codex-only bindings; do not translate its Astra or effort fields into Claude defaults.
