# ADR-0003: Use local-first SQLite and OS credential stores

- Status: Accepted
- Date: 2026-07-21

## Context

GetRest should remain useful without an account or network service. Workspaces, collections, environments, and history need transactional local persistence. Credentials require stronger protection than ordinary application records.

## Decision

Use SQLite as the primary local database. Store credentials and secret environment values in the operating-system credential store, while SQLite holds stable references and non-secret metadata.

Use Windows Credential Manager, macOS Keychain, and a Secret Service-compatible backend on Linux. Exports exclude secrets by default.

## Consequences

- The application works offline and does not require cloud infrastructure.
- SQLite provides portable, transactional persistence and explicit migrations.
- Secret handling needs platform-specific adapters and integration tests.
- Database backups alone do not reproduce credentials on another machine.
- Any future synchronization feature must define encryption, conflict resolution, and secret-transfer behavior in a new ADR.

## Alternatives considered

- **Plain JSON or YAML files**: easy to inspect, but weaker for transactional updates, indexing, and growing history.
- **Secrets in SQLite**: simpler schema, but unacceptable plaintext exposure without a separate encryption and key-management design.
- **Mandatory cloud database**: conflicts with local-first operation and introduces avoidable privacy and availability dependencies.
