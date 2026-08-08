export interface EnvironmentVariable {
  name: string;
  value: string;
}

export interface WorkspaceEnvironment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
}

export interface SaveWorkspaceEnvironmentInput {
  workspaceId: string;
  environment: Omit<WorkspaceEnvironment, "id"> & {
    id: string | null;
  };
}

export interface DeleteWorkspaceEnvironmentInput {
  workspaceId: string;
  environmentId: string;
}

export interface WorkspaceEnvironmentMutationResult {
  workspace: import("./workspace").WorkspaceSummary;
  environments: WorkspaceEnvironment[];
}

export interface SaveWorkspaceEnvironmentResult extends WorkspaceEnvironmentMutationResult {
  environment: WorkspaceEnvironment;
}
