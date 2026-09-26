# Claude Code project adapter

Use the repository's common [execution contract](../agent-execution-contract.md), [orchestration](../orchestration.md), [QA](../qa.md), and [child task contract](../request-intake/delegation.md). This file translates those responsibilities to Claude Code; it does not change Codex/OMX model cohorts or claim that two hosts have equivalent enforcement.

## Loading and scope

Root `CLAUDE.md` explicitly imports `@AGENTS.md`, then points here. The import is deliberate: Claude Code can otherwise choose a project/ancestor `CLAUDE.md` instead of automatic `AGENTS.md` discovery. Read the task-specific guide after the root contract, not the entire docs tree at startup. Check the actual loaded instructions in a fresh trusted checkout; file presence and a passing static test are not runtime evidence.

The four project subagents live in `.claude/agents/knu_{explorer,researcher,executor,reviewer}.md`. Their YAML `name`, `description`, and `tools` are native Claude metadata. They inherit the host-selected model unless a future authorized setting says otherwise; no Codex `reasoning_effort`, `agent_type`, `modelRequest`, or reviewer Astra pin is translated into an invented Claude parameter. Use one writer, bounded read/write scope, source snapshot, acceptance and stop conditions. The lead owns routing, fan-in and final verification.

| Role             | Allowed tool class                    | Task boundary                                                             |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `knu_explorer`   | Read, Grep, Glob                      | Current repository facts only                                             |
| `knu_researcher` | Read, Grep, Glob, WebSearch, WebFetch | Current primary-source research for a chosen technology                   |
| `knu_executor`   | Read, Grep, Glob, Edit, Write, Bash   | One explicitly owned implementation slice and close verification          |
| `knu_reviewer`   | Read, Grep, Glob                      | Independent frozen-source assessment; lead/runner provides diff and tests |

Read-only roles omit Bash, Edit, Write, Agent, and broad MCP tools. This is a capability limit only if the **loaded** role/tool allowlist and current host permissions actually enforce it. The agent text is a behavioral instruction, not a sandbox. Parent permission modes can override a subagent's mode; never qualify read-only under bypass/auto-accept merely because a role file says so. If the host cannot prove a safe role, do not dispatch that role; provide the packet to a verified read-only path or keep work with the lead. Do not grant Bash to a read-only role just to obtain Git output: the lead may provide a frozen diff or use a separately approved read surface.

Use native role dispatch only after verifying project discovery and tool availability in the active Claude session. Do not call another `claude`, `codex`, or agent CLI through Bash as a child-work or permission workaround. Child-to-child delegation and peer work transfer are excluded. A helper that cannot perform its bounded task returns the exact missing capability to the lead. Current effective model, role, tool/permission mode, and any unavailable mechanism belong in the handoff evidence; names or settings files alone do not prove them.

## Project visual skills

The project Redesign copy is in `.claude/skills/redesign-existing-projects/`, containing `SKILL.md`, MIT `LICENSE`, and `SOURCE.json`. It comes from the previously reviewed Codex installation at commit `c184364c58658b2f131b4ae8bd3d206cabb3deee`; the `SOURCE.json` _qualification_ string describes the **old Codex invocation only**, not Claude qualification. Do not edit the existing personal `~/.codex/skills`, claim global Claude installation, or invoke a skill as authority for product edits. See [visual skill choice](../visual-design/design-task-orchestration.md#task-fit-skills).

Taste (`design-taste-frontend`) is **Codex-only**. Do not port, install or invoke it as a Claude workflow requirement. Claude visual work uses the common VisualBrief/content/a11y/review contract directly, with Redesign only when relevant and qualified; no replacement skill is required. The shared upstream repository name `taste-skill` in Redesign provenance does not make the two skills the same adoption target.

The lead chooses at most the relevant skill for an approved design task and checks current project discovery/instructions. A read-only skill smoke checks discovery and instruction consumption without changing a product file. Use a separate disposable fixture for an authorized rendering/implementation check. If discovery, model access, permission, or instruction consumption cannot be observed, mark Claude skill qualification **pending**, even when the files and static hash tests pass.

## Bounded fresh-host qualification

The `repository-prepared` milestone covers static adapter checks and a reproducible clean checkout. Actual Claude invocation and cross-provider QA are deferred to a **separately authorized** adoption run after account access, host permissions and current capabilities are available. Preparing the repository does not request account creation, plan purchase, login or model calls. Missing account access does not block static preparation; it does prevent claiming `runtime-qualified` or approving unverified native dispatch.

On a trusted disposable checkout with no credential/product write target, record `claude --version`, loaded project instruction/role/skill source, exact invoked role, effective tools/permission mode, command/result, and `git diff`. Use the same requirement packet for direct analysis, plan, bounded implementation and independent review. Include a harmless write denial for a read-only role and an allowed disposable edit/test plus failing-test report for the executor. Never use production, PR/merge, secret reads, global settings changes, or a bypass mode to make the smoke pass. A CLI `--agent` flag or saved role file alone is not evidence of project discovery. If account or host access is unavailable, retain deterministic checks and report native-runtime acceptance as blocked rather than fabricating a PASS.

Official references: [memory and imports](https://code.claude.com/docs/en/memory), [subagents](https://code.claude.com/docs/en/sub-agents), [skills](https://code.claude.com/docs/en/skills), [CLI](https://code.claude.com/docs/en/cli-usage).
