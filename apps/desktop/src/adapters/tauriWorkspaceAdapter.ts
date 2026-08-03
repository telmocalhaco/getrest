import { invoke } from "@tauri-apps/api/core";
import type {
  CreateWorkspaceInput,
  CreateWorkspaceCollectionInput,
  DeleteWorkspaceCollectionInput,
  DeleteWorkspaceRequestInput,
  RenameWorkspaceInput,
  RenameWorkspaceCollectionInput,
  SaveWorkspaceRequestInput,
  SaveWorkspaceRequestResult,
  WorkspaceCollection,
  WorkspaceCollectionsMutationResult,
  WorkspaceSummary,
} from "../domain/workspace";

interface SerializedCommandError {
  code?: string;
  message?: string;
}

export class WorkspaceCommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceCommandError";
  }
}

export async function invokeChooseWorkspaceDirectory(): Promise<string | null> {
  return invokeCommand<string | null>("choose_workspace_directory");
}

export async function invokeCreateWorkspace(
  input: CreateWorkspaceInput,
): Promise<WorkspaceSummary> {
  return invokeCommand<WorkspaceSummary>("create_workspace", { input });
}

export async function invokeGetActiveWorkspace(): Promise<WorkspaceSummary | null> {
  return invokeCommand<WorkspaceSummary | null>("get_active_workspace");
}

export async function invokeListWorkspaces(): Promise<WorkspaceSummary[]> {
  return invokeCommand<WorkspaceSummary[]>("list_workspaces");
}

export async function invokeActivateWorkspace(
  id: string,
): Promise<WorkspaceSummary> {
  return invokeCommand<WorkspaceSummary>("activate_workspace", { id });
}

export async function invokeRenameWorkspace(
  input: RenameWorkspaceInput,
): Promise<WorkspaceSummary> {
  return invokeCommand<WorkspaceSummary>("rename_workspace", { input });
}

export async function invokeLoadWorkspaceCollections(
  id: string,
): Promise<WorkspaceCollection[]> {
  return invokeCommand<WorkspaceCollection[]>("load_workspace_collections", {
    id,
  });
}

export async function invokeSaveWorkspaceRequest(
  input: SaveWorkspaceRequestInput,
): Promise<SaveWorkspaceRequestResult> {
  return invokeCommand<SaveWorkspaceRequestResult>("save_workspace_request", {
    input,
  });
}

export async function invokeRenameWorkspaceCollection(
  input: RenameWorkspaceCollectionInput,
): Promise<WorkspaceCollectionsMutationResult> {
  return invokeCommand<WorkspaceCollectionsMutationResult>(
    "rename_workspace_collection",
    { input },
  );
}

export async function invokeCreateWorkspaceCollection(
  input: CreateWorkspaceCollectionInput,
): Promise<WorkspaceCollectionsMutationResult> {
  return invokeCommand<WorkspaceCollectionsMutationResult>(
    "create_workspace_collection",
    { input },
  );
}

export async function invokeDeleteWorkspaceRequest(
  input: DeleteWorkspaceRequestInput,
): Promise<WorkspaceCollectionsMutationResult> {
  return invokeCommand<WorkspaceCollectionsMutationResult>(
    "delete_workspace_request",
    { input },
  );
}

export async function invokeDeleteWorkspaceCollection(
  input: DeleteWorkspaceCollectionInput,
): Promise<WorkspaceCollectionsMutationResult> {
  return invokeCommand<WorkspaceCollectionsMutationResult>(
    "delete_workspace_collection",
    { input },
  );
}

async function invokeCommand<T>(
  command: string,
  arguments_: Record<string, unknown> = {},
): Promise<T> {
  try {
    return await invoke<T>(command, arguments_);
  } catch (error) {
    if (isSerializedCommandError(error)) {
      throw new WorkspaceCommandError(
        error.code ?? "workspace_operation_failed",
        error.message ?? "The workspace operation could not be completed.",
      );
    }

    throw new WorkspaceCommandError(
      "workspace_operation_failed",
      "The native workspace service could not complete the operation.",
    );
  }
}

function isSerializedCommandError(
  value: unknown,
): value is SerializedCommandError {
  return typeof value === "object" && value !== null;
}
