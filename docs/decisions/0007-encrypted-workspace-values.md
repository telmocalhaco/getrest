# ADR-0007: Encrypt protected values in Git workspaces

- Status: Accepted
- Date: 2026-08-25

## Context

Request metadata needs to travel with a dedicated Git workspace, including header names and values. Header values can contain API keys, bearer tokens, cookies, and other credentials, so plaintext workspace files and ordinary Git access are not acceptable. A user may deliberately share a workspace across machines and needs an offline, manual way to transfer decryption authority.

## Decision

Give each workspace an independent random 256-bit encryption key. Store that key in the operating-system credential store and never expose it through the React/Tauri request adapter.

Persist header names as ordinary workspace metadata. Encrypt every header value with AES-256-GCM using a unique random 96-bit nonce. Authenticate the workspace identifier, request identifier, header position, and header name as associated data so encrypted values cannot be moved silently between contexts.

Allow an explicit manual export of the workspace key to a clearly marked JSON secret file and an explicit import on another machine. Refuse to export the key inside the workspace directory, use restrictive file permissions where the platform supports them, validate the workspace identifier and algorithm during import, and verify imported keys against existing ciphertext before replacing the locally stored key.

## Consequences

- Git can synchronize header definitions and ciphertext without receiving plaintext header values.
- A cloned workspace with protected values cannot be opened until its key is imported.
- Anyone who obtains both the workspace and its exported key can decrypt protected values; users must transfer and store key exports as secrets.
- Loss of both the operating-system credential and every manual export makes the encrypted values unrecoverable.
- Encryption keys remain local unless the user deliberately exports them. There is no automatic key synchronization, cloud recovery, or telemetry.
- Key rotation and password-protected key exports require separate designs if added later.

## Alternatives considered

- **Plaintext values in Git**: rejected because repository history and remotes would expose credentials.
- **Reversible obfuscation with an application-wide embedded key**: rejected because extracting one distributed key would compromise every workspace.
- **Store values only in the operating-system credential store**: safer for one machine, but request files could not be shared as a self-contained encrypted workspace and references would be harder to reconcile.
- **Password-derived keys**: not selected initially because password recovery, derivation parameters, rotation, and interactive unlock state add complexity. A random key transferred manually provides stronger entropy with a smaller implementation surface.
