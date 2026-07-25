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
