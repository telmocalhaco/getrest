import {
  invokeChooseWorkspaceDirectory,
  invokeCreateWorkspaceCollection,
  invokeActivateWorkspace,
  invokeCreateWorkspace,
  invokeGetActiveWorkspace,
  invokeListWorkspaces,
  invokeLoadWorkspaceCollections,
  invokeRenameWorkspace,
  invokeRenameWorkspaceCollection,
  invokeSaveWorkspaceRequest,
  WorkspaceCommandError,
} from "../adapters/tauriWorkspaceAdapter";
import type {
  GitAuthor,
  WorkspaceCollection,
  WorkspaceRequest,
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

export async function saveWorkspaceRequest(
  workspaceId: string,
  collectionName: string,
  request: Omit<WorkspaceRequest, "id" | "name"> & {
    id: string | null;
    name: string;
  },
) {
  const normalizedName = request.name.trim();
  const normalizedCollection = collectionName.trim();
  const normalizedPath = request.path.trim();
  if (!workspaceId.trim()) {
    throw new WorkspaceServiceError(
      "workspace_required",
      "Create or select a workspace before saving a request.",
    );
  }
  if (!normalizedName) {
    throw new WorkspaceServiceError(
      "invalid_request_name",
      "Enter a request name.",
    );
  }
  if (!normalizedCollection) {
    throw new WorkspaceServiceError(
      "invalid_collection_name",
      "Enter a collection name.",
    );
  }
  let url: URL;
  try {
    url = new URL(normalizedPath);
  } catch {
    throw new WorkspaceServiceError(
      "invalid_request_url",
      "Enter a valid HTTP or HTTPS URL before saving.",
    );
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new WorkspaceServiceError(
      "invalid_request_url",
      "Only HTTP and HTTPS request URLs can be saved.",
    );
  }

  return runWorkspaceOperation(() =>
    invokeSaveWorkspaceRequest({
      workspaceId: workspaceId.trim(),
      collectionName: normalizedCollection,
      request: {
        ...request,
        id: request.id?.trim() || null,
        name: normalizedName,
        path: normalizedPath,
      },
    }),
  );
}

export async function renameWorkspaceCollection(
  workspaceId: string,
  currentName: string,
  newName: string,
) {
  const normalizedCurrentName = currentName.trim();
  const normalizedNewName = newName.trim();
  if (!workspaceId.trim()) {
    throw new WorkspaceServiceError(
      "workspace_required",
      "Create or select a workspace before renaming a collection.",
    );
  }
  if (!normalizedCurrentName || !normalizedNewName) {
    throw new WorkspaceServiceError(
      "invalid_collection_name",
      "Enter a collection name.",
    );
  }
  return runWorkspaceOperation(() =>
    invokeRenameWorkspaceCollection({
      workspaceId: workspaceId.trim(),
      currentName: normalizedCurrentName,
      newName: normalizedNewName,
    }),
  );
}

export async function createWorkspaceCollection(
  workspaceId: string,
  name: string,
) {
  const normalizedName = name.trim();
  if (!workspaceId.trim()) {
    throw new WorkspaceServiceError(
      "workspace_required",
      "Create or select a workspace before creating a collection.",
    );
  }
  if (!normalizedName) {
    throw new WorkspaceServiceError(
      "invalid_collection_name",
      "Enter a collection name.",
    );
  }
  return runWorkspaceOperation(() =>
    invokeCreateWorkspaceCollection({
      workspaceId: workspaceId.trim(),
      name: normalizedName,
    }),
  );
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
