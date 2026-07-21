# ADR-0002: Execute API traffic in the Rust core

- Status: Accepted
- Date: 2026-07-21

## Context

An API client needs capabilities that are not reliably available from a WebView: unrestricted target origins, custom TLS behavior, client certificates, proxies, streaming, WebSockets, SSE, and gRPC. Executing requests in the UI would also make browser CORS behavior part of the desktop product's networking model.

## Decision

Execute API traffic in a reusable Rust core. The React application sends validated, typed request models through a narrow Tauri adapter. The Rust core resolves variables and credentials, performs the request, and returns structured metadata and bounded response content.

The core must not depend on React and should keep Tauri command handlers separate from protocol and domain behavior.

## Consequences

- GetRest is not constrained by browser CORS rules.
- Protocol behavior can be tested without launching the desktop UI.
- The same core can support a future CLI.
- Large responses require streaming or temporary-file designs rather than naïve IPC copies.
- Cancellation, timeouts, redaction, and resource cleanup become explicit core responsibilities.

## Alternatives considered

- **WebView `fetch`**: simpler for basic HTTP, but insufficient for the complete desktop API-client feature set.
- **Node.js sidecar**: a familiar networking ecosystem, but adds another runtime and process boundary. It may be reconsidered only for a future sandboxed plugin system.
