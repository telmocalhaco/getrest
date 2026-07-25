# ADR-0006: Dedicated Git repositories for workspaces

- Status: Accepted
- Date: 2026-07-24

## Context

GetRest workspaces need to remain fully usable on one machine while also
supporting backup, history, and collaboration through a remote Git repository.
Workspace data must never be mixed with the GetRest application source, and
secret environment values must not enter version control.

Allowing a workspace to live inside an arbitrary existing repository would
introduce ambiguous ownership, nested repository behavior, mixed history, and a
higher risk of committing unrelated or sensitive files.

## Decision

Every GetRest workspace uses a dedicated directory selected by the user.

When a workspace is created, GetRest:

1. Requires the selected directory to be empty.
2. Rejects directories nested inside another Git repository.
3. Writes a versioned `workspace.json` manifest at the repository root.
4. Creates the local `collections/` and `environments/` directories.
5. Asks whether the current collections should be included or the workspace
   should start empty.
6. Initializes a Git repository with `main` as its initial branch.
7. Creates an initial commit using the configured Git identity.
8. Stores the workspace location only in GetRest's local SQLite database.

A workspace is local-only while its Git repository has no remote. Associating a
remote later enables backup and sharing without changing the workspace format.

Git operations run in the Rust core by invoking the Git executable directly
with controlled arguments. GetRest does not expose arbitrary shell execution
and does not store Git credentials.

Committed environment files may contain public values and secret references.
Secret values remain in the operating system credential store and local
workspace overrides.

## Initial repository layout

```text
workspace.json
collections/
environments/
```

The initial manifest contains a schema version, stable workspace identifier,
display name, and creation timestamp. Future schema changes require explicit
migrations.

Collections are stored as validated, versioned JSON files. Renaming a workspace
updates the manifest and creates a commit in that workspace repository. The
local registry can contain several workspaces, with one marked as most recently
active; changing workspace loads its own collection files.

## Consequences

- Workspace history remains separate from application development history.
- A local workspace receives version history before a remote is configured.
- Remote hosting remains provider-neutral.
- Empty-directory and parent-repository validation reduce accidental data loss
  and nested repository confusion.
- Git must be installed on the machine.
- Users without a configured Git identity must provide a name and email before
  the first commit.
- Opening unregistered existing workspaces, cloning remotes, synchronization,
  and conflict resolution are separate future increments.

## Alternatives considered

- **Store a workspace inside an existing project repository.** Rejected because
  it mixes ownership and history and permits nested-repository mistakes.
- **Keep workspace data only in SQLite.** Rejected because it makes portable,
  reviewable Git backup and collaboration harder.
- **Require a remote repository during creation.** Rejected because local-only
  operation is a core product requirement.
