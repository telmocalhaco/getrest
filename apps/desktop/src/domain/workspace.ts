export type WorkspaceGitState =
  "localOnly" | "clean" | "changes" | "unavailable";

export interface WorkspaceSummary {
  id: string;
  name: string;
  path: string;
  gitState: WorkspaceGitState;
  hasRemote: boolean;
}

export interface GitAuthor {
  name: string;
  email: string;
}

export interface WorkspaceRequest {
  id: string;
  name: string;
  method: string;
  path: string;
  body: string;
}

export interface WorkspaceCollection {
  name: string;
  requests: WorkspaceRequest[];
}

export interface CreateWorkspaceInput {
  directory: string;
  gitAuthor: GitAuthor | null;
  collections: WorkspaceCollection[];
}

export interface RenameWorkspaceInput {
  id: string;
  name: string;
}

export interface SaveWorkspaceRequestInput {
  workspaceId: string;
  collectionName: string;
  request: Omit<WorkspaceRequest, "id"> & {
    id: string | null;
  };
}

export interface SaveWorkspaceRequestResult {
  workspace: WorkspaceSummary;
  collections: WorkspaceCollection[];
  request: WorkspaceRequest;
}

export interface RenameWorkspaceCollectionInput {
  workspaceId: string;
  currentName: string;
  newName: string;
}

export interface CreateWorkspaceCollectionInput {
  workspaceId: string;
  name: string;
}

export interface DeleteWorkspaceRequestInput {
  workspaceId: string;
  requestId: string;
}

export interface DeleteWorkspaceCollectionInput {
  workspaceId: string;
  name: string;
}

export interface WorkspaceCollectionsMutationResult {
  workspace: WorkspaceSummary;
  collections: WorkspaceCollection[];
}
