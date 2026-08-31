import {
  invokeChooseImportFiles,
  invokeChooseWorkspaceDirectory,
  invokeCreateWorkspaceCollection,
  invokeDeleteWorkspaceCollection,
  invokeDeleteWorkspaceRequest,
  invokeActivateWorkspace,
  invokeCreateWorkspace,
  invokeGetActiveWorkspace,
  invokeExportWorkspaceKey,
  invokeImportWorkspaceKey,
  invokeImportWorkspaceData,
  invokeListWorkspaces,
  invokeLoadWorkspaceCollections,
  invokeRenameWorkspace,
  invokeRenameWorkspaceCollection,
  invokeSaveWorkspaceRequest,
  WorkspaceCommandError,
} from "../adapters/tauriWorkspaceAdapter";
import { parseImportFiles } from "@getrest/formats";
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

export async function exportWorkspaceKey(
  workspaceId: string,
): Promise<string | null> {
  const id = requireWorkspaceId(workspaceId);
  return runWorkspaceOperation(() => invokeExportWorkspaceKey(id));
}

export async function importWorkspaceKey(
  workspaceId: string,
): Promise<boolean> {
  const id = requireWorkspaceId(workspaceId);
  return runWorkspaceOperation(() => invokeImportWorkspaceKey(id));
}

export async function importWorkspaceData(
  workspaceId: string,
  scope: "all" | "environments" = "all",
) {
  const id = requireWorkspaceId(workspaceId);
  const files = await runWorkspaceOperation(() => invokeChooseImportFiles());
  if (files.length === 0) return null;
  let parsed;
  try {
    parsed = parseImportFiles(files);
  } catch (error) {
    throw new WorkspaceServiceError(
      "workspace_import_invalid",
      error instanceof Error
        ? error.message
        : "The selected exports are invalid.",
    );
  }
  if (scope === "environments" && parsed.environments.length === 0) {
    throw new WorkspaceServiceError(
      "workspace_import_invalid",
      "The selected exports do not contain environments. Choose an environment export from Postman, Hoppscotch, or Yaak.",
    );
  }
  const result = await runWorkspaceOperation(() =>
    invokeImportWorkspaceData({
      workspaceId: id,
      collections: scope === "environments" ? [] : parsed.collections,
      environments: parsed.environments,
    }),
  );
  return {
    ...result,
    skippedRequests: scope === "environments" ? 0 : parsed.skippedRequests,
    skippedVariables: parsed.skippedVariables,
    skippedSecretVariables: parsed.skippedSecretVariables,
    omittedFields: scope === "environments" ? 0 : parsed.omittedFields,
  };
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
  if (!isHttpUrlOrTemplate(normalizedPath)) {
    throw new WorkspaceServiceError(
      "invalid_request_url",
      "Enter a valid HTTP or HTTPS URL or variable template before saving.",
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

function isHttpUrlOrTemplate(value: string): boolean {
  if (!value.includes("{{")) {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }
  if (!(
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("{{")
  ))
    return false;
  const withoutPlaceholders = value.replace(
    /{{\s*[A-Za-z_][A-Za-z0-9_.-]*\s*}}/g,
    "value",
  );
  return (
    !withoutPlaceholders.includes("{{") && !withoutPlaceholders.includes("}}")
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

export async function deleteWorkspaceRequest(
  workspaceId: string,
  requestId: string,
) {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedRequestId = requestId.trim();
  if (!normalizedWorkspaceId) {
    throw new WorkspaceServiceError(
      "workspace_required",
      "Create or select a workspace before deleting a request.",
    );
  }
  if (!normalizedRequestId) {
    throw new WorkspaceServiceError(
      "request_required",
      "Select a saved request before deleting it.",
    );
  }
  return runWorkspaceOperation(() =>
    invokeDeleteWorkspaceRequest({
      workspaceId: normalizedWorkspaceId,
      requestId: normalizedRequestId,
    }),
  );
}

export async function deleteWorkspaceCollection(
  workspaceId: string,
  name: string,
) {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedName = name.trim();
  if (!normalizedWorkspaceId) {
    throw new WorkspaceServiceError(
      "workspace_required",
      "Create or select a workspace before deleting a collection.",
    );
  }
  if (!normalizedName) {
    throw new WorkspaceServiceError(
      "invalid_collection_name",
      "Select a collection before deleting it.",
    );
  }
  return runWorkspaceOperation(() =>
    invokeDeleteWorkspaceCollection({
      workspaceId: normalizedWorkspaceId,
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

function requireWorkspaceId(value: string): string {
  const id = value.trim();
  if (!id) {
    throw new WorkspaceServiceError(
      "workspace_required",
      "Create or select a workspace first.",
    );
  }
  return id;
}
