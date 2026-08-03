# GetRest

GetRest is an open-source, local-first desktop application for designing,
executing, organizing, and inspecting API requests.

The project aims to provide a fast, private, and dependable development
environment across macOS, Windows, and Linux. Request execution and access to
operating-system capabilities live in the native Rust layer, while the
interface is built with React and TypeScript.

> [!NOTE]
> GetRest is in an early stage of development. The current desktop shell is an
> interactive prototype with an initial native REST request flow, dedicated
> local Git workspaces, and versioned collection migration during workspace
> creation. Requests and collections support explicit create, update, and delete
> operations in workspace repositories. Automatic
> persistence while editing, remote synchronization, advanced request options,
> and the remaining protocols are still under development.

## Product principles

- **Local first:** projects, environments, history, and settings should remain
  usable without an account or internet connection.
- **Private by default:** telemetry is disabled unless it is explicitly
  approved and introduced with clear user consent.
- **Native networking:** requests are executed by the Rust core rather than the
  embedded web view.
- **Cross-platform:** behavior should remain consistent across macOS, Windows,
  and Linux.
- **Responsive at scale:** large collections and response payloads must not
  block the interface.
- **Contributor friendly:** the repository should remain deterministic,
  documented, and approachable.

## Planned capabilities

- Organize requests into workspaces, collections, and folders.
- Build and execute HTTP requests with parameters, headers, bodies,
  authentication, certificates, and proxy settings.
- Work with REST, GraphQL, WebSocket, Server-Sent Events, and gRPC APIs.
- Manage local environments and reusable variables.
- Inspect response status, timing, headers, cookies, and formatted bodies.
- Keep local request history and reusable examples.
- Import and export common API description and request formats.
- Protect sensitive values using the operating system's credential store.

## Architecture

GetRest follows a layered architecture with explicit boundaries:

| Layer                  | Responsibility                                                  |
| ---------------------- | --------------------------------------------------------------- |
| React presentation     | Screens, components, editors, and user interaction              |
| TypeScript application | Use cases, validation, and application state                    |
| Typed Tauri adapter    | Narrow contract between TypeScript and Rust                     |
| Rust core              | Networking, protocol handling, persistence, and native services |
| SQLite and OS services | Local data storage and protected credentials                    |

The interface must not invoke Tauri commands directly. Native operations are
exposed through typed application services so that the UI remains testable and
the desktop boundary stays controlled.

## Repository structure

```text
apps/desktop        Desktop application and Tauri host
crates/api-engine   Native request and protocol execution
crates/storage      SQLite persistence and migrations
crates/secrets      Operating-system credential integration
crates/models       Shared Rust domain models
packages/ui         Reusable interface components and design tokens
packages/formats    Import and export adapters
docs                Architecture and engineering decisions
scripts/setup       Platform-specific development setup
```

Some directories represent the intended architecture and will be introduced as
the implementation evolves.

## Prerequisites

The repository pins its principal toolchain versions:

- Node.js 24.18.0
- npm 11.16.0
- Rust 1.97.1 with `rustfmt` and `clippy`

Use npm as the only JavaScript package manager and keep the root lockfile
authoritative.

The setup scripts install and validate the platform dependencies:

```bash
# macOS
bash scripts/setup/macos.sh

# Ubuntu
bash scripts/setup/ubuntu.sh
```

On Windows, run the following command from PowerShell:

```powershell
.\scripts\setup\windows.ps1
```

After setup, reopen the terminal if a newly installed command is not yet
available on `PATH`.

## Getting started

```bash
git clone https://github.com/telmocalhaco/getrest.git
cd getrest
npm install
npm run tauri -- dev
```

The last command starts the frontend development server and opens the native
desktop window.

## Development commands

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the frontend development server    |
| `npm run tauri -- dev` | Start the complete desktop application   |
| `npm run typecheck`    | Validate TypeScript types                |
| `npm run test`         | Run JavaScript and TypeScript tests      |
| `npm run build`        | Build all workspaces                     |
| `npm run format`       | Format supported project files           |
| `npm run format:check` | Check formatting without modifying files |

Run the Rust quality checks from the repository root:

```bash
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check
cargo clippy \
  --manifest-path apps/desktop/src-tauri/Cargo.toml \
  --locked \
  --all-targets \
  -- -D warnings
cargo test \
  --manifest-path apps/desktop/src-tauri/Cargo.toml \
  --locked
```

## Development rules

### Code and architecture

- Respect the existing architectural boundaries and keep native behavior
  behind typed application services.
- Execute network requests in Rust, never in the web view.
- Keep components focused, accessible, and reusable.
- Avoid blocking the interface with filesystem, database, parsing, or network
  work.
- Prefer small, cohesive changes over broad rewrites.
- Add tests for new behavior and a regression test for every bug fix whenever
  practical.
- Introduce no new compiler, linter, type-checking, or test warnings.
- Record significant architectural decisions in `docs/decisions/`.

### Dependencies

- Add a dependency only when its value outweighs its maintenance, security, and
  binary-size cost.
- Prefer actively maintained packages with compatible open-source licenses.
- Pin dependencies through the repository lockfiles and never introduce a
  second JavaScript package manager.
- Review native dependencies for support across all target operating systems.

### Security and privacy

- Never commit credentials, tokens, certificates, private keys, or real
  environment files.
- Store protected values in the operating system's credential store, not in
  SQLite, logs, or source control.
- Redact authorization headers, cookies, passwords, tokens, and other sensitive
  values from logs and error reports.
- Treat imported files, remote responses, and generated content as untrusted
  input.
- Grant the desktop application only the permissions required by implemented
  features.
- Do not expose arbitrary shell execution or unrestricted filesystem access to
  the interface.

### Git and pull requests

- Keep `main` stable and use short-lived branches such as `feature/...`,
  `fix/...`, or `docs/...`.
- Write focused commits with clear, imperative messages.
- Do not mix unrelated refactors with feature or bug-fix work.
- Document user-visible changes and update relevant technical documentation.
- Before requesting review, inspect the final diff and run the applicable
  quality checks.

## Quality gates

A change is ready for review when the checks relevant to its scope pass:

1. Deterministic dependency installation.
2. Formatting and TypeScript type checking.
3. JavaScript, TypeScript, and Rust tests.
4. Rust formatting and Clippy with warnings treated as errors.
5. A successful desktop build.
6. Manual validation on affected operating systems and interaction paths.

Changes that affect persistent data must include a forward migration and a
tested recovery strategy. Changes that affect sensitive data require an
explicit security review.

## Contributing

1. Create a focused branch from the latest `main`.
2. Install dependencies using the pinned toolchains.
3. Implement the change within the established architecture.
4. Add or update tests and documentation.
5. Run the applicable quality gates.
6. Open a pull request explaining the problem, the solution, validation steps,
   and any known limitations.

For more detail, see:

- [Architecture](docs/architecture.md)
- [Architecture decisions](docs/decisions/README.md)
- [Development environment setup](scripts/setup/README.md)
- [Desktop application](apps/desktop/README.md)

## License

GetRest is distributed under the
[GNU General Public License v3.0 or later](LICENSE).
