import {
  invokeChooseWorkspaceDirectory,
  invokeActivateWorkspace,
  invokeCreateWorkspace,
  invokeGetActiveWorkspace,
  invokeListWorkspaces,
  invokeLoadWorkspaceCollections,
  invokeRenameWorkspace,
  WorkspaceCommandError,
} from "../adapters/tauriWorkspaceAdapter";
import type {
  GitAuthor,
  WorkspaceCollection,
  WorkspaceSummary,
} from "../domain/workspace";

export class WorkspaceServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceServiceError";
  }
}

export async function selectWorkspaceDirectory(): Promise<string | null> {
  return runWorkspaceOperation(() => invokeChooseWorkspaceDirectory());
}

export async function createWorkspace(
  directory: string,
  gitAuthor: GitAuthor | null = null,
  collections: WorkspaceCollection[] = [],
): Promise<WorkspaceSummary> {
  if (!directory.trim()) {
    throw new WorkspaceServiceError(
      "invalid_workspace_directory",
      "Choose a folder for the workspace.",
    );
  }

  const normalizedAuthor = gitAuthor
    ? {
        name: gitAuthor.name.trim(),
        email: gitAuthor.email.trim(),
      }
    : null;
  if (normalizedAuthor && (!normalizedAuthor.name || !normalizedAuthor.email)) {
    throw new WorkspaceServiceError(
      "invalid_git_identity",
      "Enter the Git author name and email.",
    );
  }

  return runWorkspaceOperation(() =>
    invokeCreateWorkspace({
      directory: directory.trim(),
      gitAuthor: normalizedAuthor,
      collections,
    }),
  );
}

export async function getActiveWorkspace(): Promise<WorkspaceSummary | null> {
  return runWorkspaceOperation(() => invokeGetActiveWorkspace());
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return runWorkspaceOperation(() => invokeListWorkspaces());
}

export async function activateWorkspace(id: string): Promise<WorkspaceSummary> {
  return runWorkspaceOperation(() => invokeActivateWorkspace(id));
}

export async function renameWorkspace(
  id: string,
  name: string,
): Promise<WorkspaceSummary> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new WorkspaceServiceError(
      "invalid_workspace_name",
      "Enter a workspace name.",
    );
  }
  return runWorkspaceOperation(() =>
    invokeRenameWorkspace({ id, name: normalizedName }),
  );
}

export async function loadWorkspaceCollections(
  id: string,
): Promise<WorkspaceCollection[]> {
  return runWorkspaceOperation(() => invokeLoadWorkspaceCollections(id));
}

async function runWorkspaceOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof WorkspaceCommandError) {
      throw new WorkspaceServiceError(error.code, error.message);
    }
    throw error;
  }
}
