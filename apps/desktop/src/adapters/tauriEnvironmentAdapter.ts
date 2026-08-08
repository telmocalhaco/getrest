import { invoke } from "@tauri-apps/api/core";
import type {
  DeleteWorkspaceEnvironmentInput,
  SaveWorkspaceEnvironmentInput,
  SaveWorkspaceEnvironmentResult,
  WorkspaceEnvironment,
  WorkspaceEnvironmentMutationResult,
} from "../domain/environment";
import { WorkspaceCommandError } from "./tauriWorkspaceAdapter";

interface SerializedCommandError {
  code?: string;
  message?: string;
}

export async function invokeLoadWorkspaceEnvironments(
  workspaceId: string,
): Promise<WorkspaceEnvironment[]> {
  return invokeCommand<WorkspaceEnvironment[]>("load_workspace_environments", {
    workspaceId,
  });
}

export async function invokeSaveWorkspaceEnvironment(
  input: SaveWorkspaceEnvironmentInput,
): Promise<SaveWorkspaceEnvironmentResult> {
  return invokeCommand<SaveWorkspaceEnvironmentResult>(
    "save_workspace_environment",
    { input },
  );
}

export async function invokeDeleteWorkspaceEnvironment(
  input: DeleteWorkspaceEnvironmentInput,
): Promise<WorkspaceEnvironmentMutationResult> {
  return invokeCommand<WorkspaceEnvironmentMutationResult>(
    "delete_workspace_environment",
    { input },
  );
}

async function invokeCommand<T>(
  command: string,
  arguments_: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, arguments_);
  } catch (error) {
    if (isSerializedCommandError(error)) {
      throw new WorkspaceCommandError(
        error.code ?? "workspace_environment_operation_failed",
        error.message ?? "The environment operation could not be completed.",
      );
    }
    throw new WorkspaceCommandError(
      "workspace_environment_operation_failed",
      "The native environment service could not complete the operation.",
    );
  }
}

function isSerializedCommandError(
  value: unknown,
): value is SerializedCommandError {
  return typeof value === "object" && value !== null;
}
