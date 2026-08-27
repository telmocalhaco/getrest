# GetRest architecture

## Status

This document describes the intended architecture for the first production version of GetRest. The project is still in its foundation phase, so implementation details may evolve through Architecture Decision Records (ADRs), while the boundaries and principles below should remain stable.

## Product goals

GetRest is a local-first, open-source desktop application for developing and testing APIs on Windows, macOS, and Linux.

The architecture prioritizes:

- predictable behavior across supported desktop platforms;
- privacy and safe handling of credentials;
- native network capabilities without browser CORS restrictions;
- responsiveness with large requests and responses;
- a clear boundary between unprivileged UI code and privileged system operations;
- a codebase that is approachable to both human and AI contributors;
- reusable domain logic that can support a future command-line client.

## Non-goals for the first version

The initial architecture does not attempt to provide:

- cloud accounts or mandatory synchronization;
- remote telemetry or analytics;
- an unrestricted plugin or script execution environment;
- a web-hosted version of the complete desktop application;
- separate implementations for each operating system;
- premature services or packages without a concrete consumer.

## System context

```mermaid
flowchart LR
    User["User"] --> UI["React user interface"]
    UI --> Adapter["Typed Tauri adapter"]
    Adapter --> Core["Rust application core"]
    Core --> Engine["API engine"]
    Core --> Storage["SQLite storage"]
    Core --> Secrets["OS credential store"]
    Core --> Files["Local files"]
    Engine --> APIs["HTTP, GraphQL, WebSocket, SSE, and gRPC services"]
```

The WebView is a presentation surface. It is not the primary network engine and does not receive unrestricted operating-system access.

## Repository structure

```text
apps/
  desktop/       Tauri 2 desktop shell and React application
crates/
  api-engine/    HTTP, GraphQL, WebSocket, SSE, and gRPC execution
  storage/       SQLite persistence, migrations, import, and export
  secrets/       Cross-platform credential-store integration
  models/        Shared domain models and typed contracts
packages/
  ui/            Reusable React user-interface components
  formats/       OpenAPI, cURL, Postman, and Insomnia formats
docs/
  architecture.md
  decisions/     Architecture Decision Records
scripts/
  setup/         Native development-environment setup
```

Directories may be consolidated while they contain only trivial code. A new package or crate should have a real consumer and a clear ownership boundary.

## Architectural layers

### React presentation layer

React components render state, collect user intent, and provide accessible desktop interactions. Components must not invoke Tauri commands directly.

UI-specific concerns include:

- request and response editors;
- workspace navigation;
- history, search, and filtering;
- themes, layouts, and keyboard navigation;
- progress, cancellation, and error presentation.

Reusable components belong in `packages/ui` only when they are consumed by more than one feature or have a stable shared contract.

### TypeScript application services

Application services coordinate UI use cases and call a single typed Tauri adapter. They translate domain results into presentation state without duplicating Rust business rules.

Every TypeScript-to-Rust call must have:

- an explicit input and output contract;
- validation at the trust boundary;
- a structured error type;
- cancellation behavior where the operation can be long-running;
- tests for serialization and contract compatibility.

### Tauri boundary

The Tauri adapter is the only normal entry point from the WebView into privileged functionality. Capabilities and permissions must be minimal and scoped to the windows that require them.

The boundary must not expose:

- arbitrary shell execution;
- unrestricted file-system paths;
- raw credential-store access;
- generic commands that bypass domain validation.

### Rust application core

The Rust core owns privileged and performance-sensitive behavior:

- request execution and cancellation;
- TLS, certificates, authentication, and proxy configuration;
- persistence and migrations;
- import and export;
- secret storage and retrieval;
- local file access through narrow domain operations;
- redaction of sensitive information before logging or returning errors.

The core should be separated from Tauri-specific command handlers so that domain behavior remains independently testable and reusable by a future CLI.

## Request lifecycle

```mermaid
sequenceDiagram
    participant U as User
    participant R as React
    participant T as Typed adapter
    participant C as Rust core
    participant A as Remote API

    U->>R: Send request
    R->>T: Validated request model
    T->>C: Typed Tauri command
    C->>C: Resolve variables and credentials
    C->>A: Execute request
    A-->>C: Headers and response stream
    C-->>T: Metadata and bounded chunks
    T-->>R: Structured progress and result
    R-->>U: Render response
```

The Rust core executes REST, GraphQL, WebSocket, SSE, and gRPC traffic. This avoids browser CORS constraints and enables consistent support for proxies, custom certificates, client certificates, and protocol-specific behavior.

## Large payloads and streaming

Large bodies must not be repeatedly copied through WebView IPC. Implementations should use one or more of the following:

- bounded chunks with backpressure;
- temporary files managed by the Rust core;
- incremental parsing and rendering;
- explicit in-memory size limits;
- previews with opt-in loading of complete content.

Every long-running operation must be cancellable and clean up temporary resources after completion, cancellation, or application restart.

## Persistence

SQLite is the primary local store for the workspace registry, recent usage,
request metadata, and history. Portable collections and shared environments
live in the dedicated workspace repository. Schema changes use ordered
migrations that can be tested from every previously supported schema version.

Credentials and secret environment values must not be stored as plaintext SQLite fields. The database stores stable references to values held in the operating-system credential store:

- Windows Credential Manager;
- macOS Keychain;
- Secret Service-compatible storage on Linux.

Exports exclude secrets by default. Any explicit secret export must clearly warn the user and require a deliberate action.

## Workspace repositories

Each workspace has a dedicated directory selected by the user and a local Git
repository initialized by GetRest. A workspace repository is never nested
inside the GetRest source repository or another project repository.

Version-controlled workspace data includes:

- the versioned `workspace.json` manifest;
- collections, folders, and request definitions;
- shared environment definitions and non-secret values;
- references to secret values held outside Git.

Shared environments are stored as validated JSON files in the workspace
`environments/` directory. Each environment has a stable identifier, a display
name, and uniquely named non-secret variables. The active environment is a
local interface choice and does not rewrite saved request templates.

Request URLs and bodies use `{{variableName}}` placeholders. The TypeScript
layer forwards the selected environment values through the typed request
contract, and the Rust request engine performs a single-pass substitution
before HTTP URL validation and request execution. Missing, malformed,
duplicate, oversized, or invalid variables stop the request with a structured
error. Variable values are not recursively expanded, preventing cycles and
ambiguous evaluation order.

Environment JSON files are replaced atomically and remain uncommitted for Git
review. They contain only values that are safe to share. Passwords, tokens, API
keys, cookies, and other secrets must never be written there; a later secrets
integration will store those values in the operating-system credential store
and keep only stable references in workspace data.

The local SQLite database stores workspace locations, recent usage, history,
and application state. It does not replace the workspace repository as the
portable source of truth.

### Collection runner and load testing

Collection flows are ordered lists of saved requests. Each virtual user runs
the list sequentially and owns an isolated copy of the selected environment
variables. A step can extract a scalar or JSON value through a dotted path such
as `data.user.id` or `items.0.id`; the extracted value becomes a runtime
variable available to later URL and body templates.

The Rust network engine owns flow execution and concurrency. Functional runs
use one virtual user and one iteration. Load runs can use up to 50 virtual
users, include a configurable delay between steps, and are capped at 10,000
HTTP requests per invocation. The interface requires an explicit permission
confirmation before starting load traffic. Results contain aggregate timings,
p95 latency, throughput, pass/fail counts, per-step metrics, and a bounded set
of error samples. Response bodies and extracted values are not persisted in
the result, reducing the risk of storing sensitive data.

When creating a workspace, the user explicitly chooses whether to include the
collections currently loaded in the application or start with an empty
repository. The workspace selector can activate registered workspaces, rename
the active workspace, or start the creation of another one. Renames update both
the versioned manifest and the local registry.

The request editor uses an explicit save action. Saving creates or updates the
request by stable identifier in the selected collection, then atomically
replaces the managed collection directory. These edits remain uncommitted and
are reflected by the workspace Git status. The Rust boundary validates names,
methods, HTTP(S) URLs, sizes, workspace identity, and filesystem entry types
before changing files.

Request renames use the same stable-identifier update path. Collection renames
change only the collection name, preserve its request order and identifiers,
and reject conflicts with existing collection names.

Empty collections use the same native persistence boundary and are written
immediately to the workspace repository. The interface keeps collection names
independently from their requests so an empty collection remains visible after
loading or switching workspaces.

Creating a new request starts an in-memory draft from the request actions menu.
It becomes a workspace item only after the explicit save flow assigns a name,
collection, and stable identifier.

Deleting a request preserves its collection even when it becomes empty.
Deleting a collection removes every request it contains and therefore requires
an explicit confirmation that reports the affected request count. Both
operations atomically replace the managed collection directory and remain
uncommitted so Git can be used to review or restore the deleted files.

A workspace without a Git remote is local-only. A remote can be associated
later for backup and collaboration. Git commands are executed by the Rust core
with controlled arguments and never through an arbitrary shell interface.

## Import and export

`packages/formats` owns parsing and generation for external formats. The first
implemented adapters accept Postman, Hoppscotch, and Yaak JSON exports.
Importers treat all input as untrusted and produce a validated intermediate
model before native persistence. The native layer selects and reads regular
files with explicit count and size limits, validates the converted model again,
and writes collections and environments using staged directory replacement.
Imported headers follow the workspace encryption path. Environment variables
marked as secret by their source are omitted because versioned environment
files may contain only non-secret values.

Format conversion must preserve source information when possible and report unsupported or lossy fields instead of silently discarding them.

## Security and privacy

GetRest is local-first and collects no telemetry by default. Network activity occurs only as a result of an explicit product feature, such as executing a request or checking for updates when that behavior is enabled and documented.

Security requirements include:

- redact authorization headers, cookies, tokens, API keys, and passwords from logs;
- apply least-privilege Tauri capabilities;
- validate all IPC, file, import, and network inputs;
- use the operating-system credential store for secrets;
- never commit certificates, credentials, request dumps, or local databases;
- introduce plugins or user scripts only after documenting a threat model and sandbox strategy.

## Cross-platform strategy

The same codebase should serve Windows, macOS, and Linux. Platform-specific code is isolated behind small interfaces and tested on the actual target operating system.

Native development and release builds are produced on their target platform:

- Windows: MSVC Build Tools and WebView2;
- macOS: Xcode Command Line Tools and the system WebKit stack;
- Ubuntu: WebKitGTK and the native Linux development libraries required by Tauri.

WSL and containers may support auxiliary services and tests, but they do not replace native desktop builds.

## Quality gates

Pull requests should eventually run the following checks on Windows, macOS, and Ubuntu:

- deterministic dependency installation;
- formatting and linting;
- TypeScript type checking;
- TypeScript and Rust unit tests;
- Rust `clippy` checks;
- desktop application build;
- focused integration tests for affected protocols or platform integrations.

Behavior changes require tests. Bug fixes should include regression coverage whenever practical.

## Evolution rules

Create or update an ADR when a change:

- replaces a core framework or persistence technology;
- changes a security or trust boundary;
- introduces a service, plugin runtime, or cloud dependency;
- changes supported platforms or build strategy;
- changes the license or data-handling model;
- invalidates an accepted decision listed below.

## Related decisions

- [ADR-0001: Tauri, React, TypeScript, and Rust](decisions/0001-tauri-react-typescript-rust.md)
- [ADR-0002: Execute API traffic in the Rust core](decisions/0002-rust-network-engine.md)
- [ADR-0003: Local-first SQLite and OS credential stores](decisions/0003-local-first-storage-and-secrets.md)
- [ADR-0004: Native builds on Windows, macOS, and Ubuntu](decisions/0004-native-cross-platform-builds.md)
- [ADR-0005: GNU GPL version 3 or later](decisions/0005-gpl-3-or-later.md)
- [ADR-0006: Dedicated Git repositories for workspaces](decisions/0006-dedicated-git-workspace-repositories.md)
