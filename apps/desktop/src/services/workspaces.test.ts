import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invokeActivateWorkspace,
  invokeChooseWorkspaceDirectory,
  invokeCreateWorkspace,
  invokeGetActiveWorkspace,
  invokeListWorkspaces,
  invokeLoadWorkspaceCollections,
  invokeRenameWorkspace,
  WorkspaceCommandError,
} from "../adapters/tauriWorkspaceAdapter";
import {
  activateWorkspace,
  createWorkspace,
  getActiveWorkspace,
  listWorkspaces,
  loadWorkspaceCollections,
  renameWorkspace,
  selectWorkspaceDirectory,
  WorkspaceServiceError,
} from "./workspaces";

vi.mock("../adapters/tauriWorkspaceAdapter", () => {
  class MockWorkspaceCommandError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }

  return {
    invokeActivateWorkspace: vi.fn(),
    invokeChooseWorkspaceDirectory: vi.fn(),
    invokeCreateWorkspace: vi.fn(),
    invokeGetActiveWorkspace: vi.fn(),
    invokeListWorkspaces: vi.fn(),
    invokeLoadWorkspaceCollections: vi.fn(),
    invokeRenameWorkspace: vi.fn(),
    WorkspaceCommandError: MockWorkspaceCommandError,
  };
});

const activateWorkspaceMock = vi.mocked(invokeActivateWorkspace);
const chooseDirectoryMock = vi.mocked(invokeChooseWorkspaceDirectory);
const createWorkspaceMock = vi.mocked(invokeCreateWorkspace);
const getActiveWorkspaceMock = vi.mocked(invokeGetActiveWorkspace);
const listWorkspacesMock = vi.mocked(invokeListWorkspaces);
const loadWorkspaceCollectionsMock = vi.mocked(invokeLoadWorkspaceCollections);
const renameWorkspaceMock = vi.mocked(invokeRenameWorkspace);

describe("workspace service", () => {
  beforeEach(() => {
    activateWorkspaceMock.mockReset();
    chooseDirectoryMock.mockReset();
    createWorkspaceMock.mockReset();
    getActiveWorkspaceMock.mockReset();
    listWorkspacesMock.mockReset();
    loadWorkspaceCollectionsMock.mockReset();
    renameWorkspaceMock.mockReset();
  });

  it("selects the workspace directory through the native adapter", async () => {
    chooseDirectoryMock.mockResolvedValue("/tmp/workspace");

    await expect(selectWorkspaceDirectory()).resolves.toBe("/tmp/workspace");
  });

  it("normalizes the Git identity before creating a workspace", async () => {
    createWorkspaceMock.mockResolvedValue({
      id: "workspace-1",
      name: "workspace",
      path: "/tmp/workspace",
      gitState: "localOnly",
      hasRemote: false,
    });

    await createWorkspace("/tmp/workspace", {
      name: "  GetRest User ",
      email: " user@example.com ",
    });

    expect(createWorkspaceMock).toHaveBeenCalledWith({
      directory: "/tmp/workspace",
      gitAuthor: {
        name: "GetRest User",
        email: "user@example.com",
      },
      collections: [],
    });
  });

  it("preserves structured errors from the native workspace boundary", async () => {
    createWorkspaceMock.mockRejectedValue(
      new WorkspaceCommandError(
        "git_identity_required",
        "Git identity required.",
      ),
    );

    await expect(createWorkspace("/tmp/workspace")).rejects.toMatchObject({
      name: "WorkspaceServiceError",
      code: "git_identity_required",
      message: "Git identity required.",
    } satisfies Partial<WorkspaceServiceError>);
  });

  it("loads the active workspace through the native adapter", async () => {
    getActiveWorkspaceMock.mockResolvedValue(null);

    await expect(getActiveWorkspace()).resolves.toBeNull();
  });

  it("renames a workspace with a normalized name", async () => {
    renameWorkspaceMock.mockResolvedValue({
      id: "workspace-1",
      name: "Renamed",
      path: "/tmp/workspace",
      gitState: "localOnly",
      hasRemote: false,
    });

    await renameWorkspace("workspace-1", "  Renamed ");

    expect(renameWorkspaceMock).toHaveBeenCalledWith({
      id: "workspace-1",
      name: "Renamed",
    });
  });

  it("lists, activates, and loads workspace collections", async () => {
    listWorkspacesMock.mockResolvedValue([]);
    activateWorkspaceMock.mockResolvedValue({
      id: "workspace-1",
      name: "Workspace",
      path: "/tmp/workspace",
      gitState: "localOnly",
      hasRemote: false,
    });
    loadWorkspaceCollectionsMock.mockResolvedValue([]);

    await expect(listWorkspaces()).resolves.toEqual([]);
    await expect(activateWorkspace("workspace-1")).resolves.toMatchObject({
      id: "workspace-1",
    });
    await expect(loadWorkspaceCollections("workspace-1")).resolves.toEqual([]);
  });
});
