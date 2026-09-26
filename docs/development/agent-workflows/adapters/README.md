# Coding-agent host adapters

The repository contract is `AGENTS.md`. [Execution](../agent-execution-contract.md), [orchestration](../orchestration.md), [QA](../qa.md), and [child ownership](../request-intake/delegation.md) define shared responsibilities; the host adapter describes only how the current tool implements them. Read the adapter for the active host, not both by default.

| Host        | Entry                             | Project roles          | Host-only contract                                                              |
| ----------- | --------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Codex/OMX   | `AGENTS.md`                       | `.codex/agents/*.toml` | [Codex](./codex.md): model/effort cohorts, native routing, sandbox/OMX behavior |
| Claude Code | `CLAUDE.md` importing `AGENTS.md` | `.claude/agents/*.md`  | [Claude Code](./claude-code.md): native discovery, tools, permissions, skills   |

Names and similar task packets do not prove equivalent capabilities. Each lead checks the current host's loaded instructions, role/tool availability, effective permissions and source snapshot before dispatch. If unavailable, perform safe direct/sequential work or report a bounded blocker. Do not emulate another host's role, model, approval, or runtime state with prompt text.

The Codex-only routing/model scripts remain Codex compatibility checks, not a universal dispatcher or a Claude admission engine. Existing Codex model cohorts and required Astra QA are not satisfied by a Claude review. Cross-model review requires a separately authorized evidence packet and independent qualification.

For a Codex↔Claude checker handoff, use the [host-neutral cross-model QA contract](./cross-model-handoff.md) with the canonical [QA packet](../qa.md#portable-qa-packet). It does not install a host, select a provider model or qualify direct CLI process delegation.

## Preparation versus live adoption

`repository-prepared` means the tracked instructions, native role definitions, selective tracking, regression tests and clean-clone handoff are ready for a future developer environment. This milestone does not require buying a provider plan, logging in, or invoking another host's agents. It is not evidence of actual role discovery, permission enforcement or model behavior.

`runtime-qualified` is a separate, explicitly authorized adoption gate on the real host: current instruction/role/tool loading, allowed and denied actions, executor test reporting, applicable skills, lifecycle/cleanup, and cross-provider handoff must be observed on frozen disposable fixtures. Until then, native and cross-model execution remain unqualified; metadata and static PASS cannot authorize blind dispatch. Unsupported features use a verified direct/manual path or remain a bounded blocker. Plugin setup and model execution have separate authority and evidence; neither a prepared repository nor a host installation implies live qualification.
