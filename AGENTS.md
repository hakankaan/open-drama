# Agent Instructions

<!-- dkk:start -->
## Domain Knowledge Kit

This project uses a structured, YAML-based domain model managed by **dkk** (Domain Knowledge Kit).

Run `dkk prime` to get full agent context including domain structure, CLI commands, and workflows.

### ⚠️ Events vs Architecture

Events and Commands map business domain concepts. They **DO NOT** imply Event-Driven Architecture (EDA) or CQRS decisions.

### 🏗️ Structural vs. Content Edits

**Domain YAML is the single source of truth.** 

- **For structural changes (creates, renames, deletes):** ALWAYS use the DKK CLI commands (e.g., `dkk add`, `dkk rename`, `dkk rm`).
- **For content updates (descriptions, properties, references):** You MUST edit the YAML files directly, but you must respect the JSON Schemas (`tools/dkk/schema/`) and run `dkk render` immediately afterward to ensure cross-reference integrity and schema validation.

### 🏛️ Prioritize ADRs

**Always consult Architecture Decision Records.** Before proposing architectural refactors, making tech choices, or modifying domain logic, ask `dkk adr decisions <id>` (or `--file <path>`) what has already been decided. It follows supersession chains, so a replaced decision is never reported as still binding.

ADR ↔ domain links are **bidirectional** and both halves must be written. Use `dkk adr link`, which writes both, instead of hand-editing one side — `dkk validate` warns about one-way links, and only the item side shows up in the generated docs.

### Quick Reference

```bash
# Query
dkk list                              # List all domain items (--context, --type, --status filters)
dkk show <id>                         # Display a domain item (ADRs: frontmatter + Markdown body)
dkk show <adr-id> --section decision  # Just one section of an ADR body
dkk summary <id>                      # Concise item summary (AI-optimized)
dkk search "<query>"                  # Full-text search (--status narrows ADRs)
dkk related <id>                      # Graph traversal of related items
dkk graph                             # Mermaid.js flowchart (--layout LR|TD, --node-types ...)

# Pipeline
dkk validate                          # Schema + cross-reference validation
dkk render                            # Validate, render docs, rebuild search index

# ADR
dkk adr decisions <id>                # Which decisions govern an item/context/actor/flow (--file <path>)
dkk adr link <adr-id> <ids...>        # Link a decision to targets (writes domain_refs AND adr_refs)
dkk adr unlink <adr-id> <ids...>      # Remove a link from both sides
dkk adr status <adr-id> <status>      # proposed | accepted | rejected | deprecated | superseded
dkk adr audit                         # Decision rot: unlinked, stalled, one-way links, broken chains

# Scaffold
dkk new domain                        # Scaffold .dkk/domain/ structure (one-time, per project)
dkk new context <name>                # Scaffold a new bounded context
dkk new adr "<title>"                 # Scaffold a new ADR (--domain-refs also writes the reciprocal adr_refs)
dkk add <type> <name> --context <ctx> # Scaffold an individual domain item

# Refactor
dkk rename <old-id> <new-id>          # Rename item and update all references
dkk rm <id>                           # Remove item safely

# Audit
dkk stats                             # Domain statistics + orphaned items
dkk drift                             # Model/code drift report (code_refs bindings + git; --strict for CI)
dkk drift ack <context>               # Mark a flagged context reviewed-and-accurate at HEAD
dkk drift map <file>                  # Which context binds a source file (staleness + ADRs)

# Agent
dkk init                              # Create/update AGENTS.md with DKK section + print next steps
dkk init --claude                     # Also scaffold .claude/ (settings, hooks, skills, agents, commands)
dkk init --copilot                    # Also scaffold GitHub Copilot config (.github/ prompts, agent, skills, copilot-instructions.md, .vscode/mcp.json)
dkk init --skills                     # Also install agent skills into .github/skills/
dkk init --all                        # Install both Claude Code and Copilot config
dkk update                            # Upgrade dkk via npm + refresh .claude/.github/skills/Copilot artifacts + MCP
dkk update --diff                     # Show the unified diff for each changed file before confirming
dkk update --force                    # Overwrite locally-edited artifacts instead of keeping them
dkk artifacts check                   # Read-only drift gate for CI (non-zero exit when out of sync)
dkk prime                             # Output full agent context
dkk mcp                               # MCP server entrypoint — auto-spawned by the client via .mcp.json / .vscode/mcp.json (do not run by hand)

# Feedback (about dkk itself, not this project's domain)
dkk feedback add "<summary>"          # Record friction with dkk (--kind bug|friction|idea|docs, --detail, --command)
dkk feedback                          # List recorded feedback (--kind, --unshared)
dkk feedback export                   # Paste-ready Markdown report on stdout (--all, --mark-shared)
dkk feedback rm <id>                  # Drop an entry (redaction escape hatch)
```

Feedback is a local file (`.dkk/feedback.yml`) — nothing is transmitted. Offer to record it when the user hits a dkk bug or rough edge; never file it unprompted.

### Upgrades and local edits

`dkk update` records what it installed in `.dkk/artifacts.lock` — **commit it**. That record is what lets an upgrade tell its own previous output (safe to overwrite) from a file somebody edited (not safe). An edited artifact is reported as `! conflict`: your version stays, and the new template lands beside it as `<path>.new` to merge. Use `--diff` to see the change before answering the prompt, or `--force` to overwrite regardless.

### Model Context Protocol (MCP)

`dkk init` writes a committed `.mcp.json` registering the **dkk** MCP server (`dkk init --copilot` also writes `.vscode/mcp.json` for VS Code Copilot). Once committed, every clone gets the server automatically — the client spawns it on session start (approve the "dkk" server once when prompted). **Prefer the MCP tools** (`dkk_search`, `dkk_show`, `dkk_summary`, `dkk_related`, `dkk_decisions`, `dkk_list`, `dkk_story`, `dkk_validate`, …) over shelling out to the CLI for queries — they hit the same data with no shell-quoting fragility.

### Quality Gates

Before committing domain changes, run:

```bash
dkk render              # Validates → renders docs → rebuilds search index
```

`dkk validate` is available as a quick dry-run check (no rendering).
<!-- dkk:end -->
