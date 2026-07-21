# ADR-0001: Use Tauri 2, React, TypeScript, and Rust

- Status: Accepted
- Date: 2026-07-21

## Context

GetRest must provide one maintainable desktop codebase for Windows, macOS, and Linux. The interface will be substantial and is expected to be developed with significant AI assistance, while privileged operations require predictable performance and strong security boundaries.

The project should remain lightweight compared with applications that bundle a complete browser runtime, without sacrificing a productive and widely understood UI stack.

## Decision

Use:

- Tauri 2 as the desktop application framework;
- React and strict TypeScript for the user interface;
- Vite for frontend development and bundling;
- Rust for the privileged application core.

Keep Rust focused on network, persistence, secrets, file, and operating-system operations. Keep presentation logic and desktop interaction in TypeScript and React.

## Consequences

- The application uses each operating system's WebView and can produce smaller distributions than a bundled-Chromium architecture.
- Contributors can work on most UI features using the common React and TypeScript ecosystem.
- Privileged operations benefit from Rust's type and memory safety.
- The project must manage a typed IPC boundary and test differences between system WebViews.
- Contributors working across the full stack need both Node.js and Rust toolchains.

## Alternatives considered

- **Electron**: broader Chromium and Node.js compatibility, but greater distribution size and memory overhead.
- **Avalonia UI**: strong option for .NET teams, but the selected contributor stack favors web technologies and Rust.
- **Flutter**: suitable for highly custom cross-platform UI, but introduces Dart and a less conventional desktop integration model for this project.
- **Qt**: mature and powerful, but introduces additional C++/QML complexity and licensing considerations.
