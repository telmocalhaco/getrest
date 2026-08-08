import {
  invokeDeleteWorkspaceEnvironment,
  invokeLoadWorkspaceEnvironments,
  invokeSaveWorkspaceEnvironment,
} from "../adapters/tauriEnvironmentAdapter";
import { WorkspaceCommandError } from "../adapters/tauriWorkspaceAdapter";
import type {
  EnvironmentVariable,
  WorkspaceEnvironment,
} from "../domain/environment";
import { WorkspaceServiceError } from "./workspaces";

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export async function loadWorkspaceEnvironments(
  workspaceId: string,
): Promise<WorkspaceEnvironment[]> {
  return runEnvironmentOperation(() =>
    invokeLoadWorkspaceEnvironments(requireWorkspace(workspaceId)),
  );
}

export async function saveWorkspaceEnvironment(
  workspaceId: string,
  environment: Omit<WorkspaceEnvironment, "id"> & { id: string | null },
) {
  const normalizedWorkspaceId = requireWorkspace(workspaceId);
  const name = environment.name.trim();
  if (!name) {
    throw new WorkspaceServiceError(
      "invalid_environment_name",
      "Enter an environment name.",
    );
  }
  const variables = normalizeVariables(environment.variables);
  return runEnvironmentOperation(() =>
    invokeSaveWorkspaceEnvironment({
      workspaceId: normalizedWorkspaceId,
      environment: {
        id: environment.id?.trim() || null,
        name,
        variables,
      },
    }),
  );
}

export async function deleteWorkspaceEnvironment(
  workspaceId: string,
  environmentId: string,
) {
  const normalizedWorkspaceId = requireWorkspace(workspaceId);
  const normalizedEnvironmentId = environmentId.trim();
  if (!normalizedEnvironmentId) {
    throw new WorkspaceServiceError(
      "environment_required",
      "Select an environment before deleting it.",
    );
  }
  return runEnvironmentOperation(() =>
    invokeDeleteWorkspaceEnvironment({
      workspaceId: normalizedWorkspaceId,
      environmentId: normalizedEnvironmentId,
    }),
  );
}

function requireWorkspace(workspaceId: string): string {
  const normalized = workspaceId.trim();
  if (!normalized) {
    throw new WorkspaceServiceError(
      "workspace_required",
      "Create or select a workspace before managing environments.",
    );
  }
  return normalized;
}

function normalizeVariables(
  variables: EnvironmentVariable[],
): EnvironmentVariable[] {
  const normalized = variables
    .map((variable) => ({
      name: variable.name.trim(),
      value: variable.value,
    }))
    .filter((variable) => variable.name || variable.value);
  const names = new Set<string>();
  for (const variable of normalized) {
    if (!VARIABLE_NAME.test(variable.name)) {
      throw new WorkspaceServiceError(
        "invalid_environment_variable",
        "Variable names must start with a letter or underscore and contain only letters, numbers, dots, hyphens, or underscores.",
      );
    }
    if (names.has(variable.name)) {
      throw new WorkspaceServiceError(
        "duplicate_environment_variable",
        `The variable “${variable.name}” is defined more than once.`,
      );
    }
    names.add(variable.name);
  }
  return normalized;
}

async function runEnvironmentOperation<T>(
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
