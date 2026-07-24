# Architecture Decision Records

Architecture Decision Records (ADRs) capture decisions that materially shape GetRest. They explain the context and trade-offs so future contributors can understand why the project is structured as it is.

## Status values

- **Proposed**: under discussion and not yet binding;
- **Accepted**: active project decision;
- **Superseded**: replaced by a newer ADR;
- **Deprecated**: retained for history but no longer recommended.

Accepted ADRs are immutable historical records. If a decision changes, add a new ADR and mark the previous record as superseded.

## Index

| ADR                                                  | Status   | Decision                                           |
| ---------------------------------------------------- | -------- | -------------------------------------------------- |
| [0001](0001-tauri-react-typescript-rust.md)          | Accepted | Use Tauri 2, React, TypeScript, and Rust           |
| [0002](0002-rust-network-engine.md)                  | Accepted | Execute API traffic in the Rust core               |
| [0003](0003-local-first-storage-and-secrets.md)      | Accepted | Use SQLite and operating-system credential stores  |
| [0004](0004-native-cross-platform-builds.md)         | Accepted | Build and test natively on three operating systems |
| [0005](0005-gpl-3-or-later.md)                       | Accepted | License the project under GPL-3.0-or-later         |
| [0006](0006-dedicated-git-workspace-repositories.md) | Accepted | Use dedicated Git repositories for workspaces      |

## ADR template

```markdown
# ADR-NNNN: Decision title

- Status: Proposed
- Date: YYYY-MM-DD

## Context

What problem or constraint requires a decision?

## Decision

What has been decided?

## Consequences

What benefits, costs, risks, and follow-up work result from the decision?

## Alternatives considered

Which credible alternatives were considered and why were they not selected?
```
