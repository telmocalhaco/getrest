import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invokeActivateWorkspace,
  invokeChooseWorkspaceDirectory,
  invokeCreateWorkspaceCollection,
  invokeCreateWorkspace,
  invokeDeleteWorkspaceCollection,
  invokeDeleteWorkspaceRequest,
  invokeExportWorkspaceKey,
  invokeGetActiveWorkspace,
  invokeImportWorkspaceKey,
  invokeListWorkspaces,
  invokeLoadWorkspaceCollections,
  invokeRenameWorkspace,
  invokeRenameWorkspaceCollection,
  invokeSaveWorkspaceRequest,
  WorkspaceCommandError,
} from "../adapters/tauriWorkspaceAdapter";
import {
  activateWorkspace,
  createWorkspaceCollection,
  createWorkspace,
  deleteWorkspaceCollection,
  deleteWorkspaceRequest,
  exportWorkspaceKey,
  getActiveWorkspace,
  importWorkspaceKey,
  listWorkspaces,
  loadWorkspaceCollections,
  renameWorkspace,
  renameWorkspaceCollection,
  saveWorkspaceRequest,
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
    invokeCreateWorkspaceCollection: vi.fn(),
    invokeCreateWorkspace: vi.fn(),
    invokeDeleteWorkspaceCollection: vi.fn(),
    invokeDeleteWorkspaceRequest: vi.fn(),
    invokeExportWorkspaceKey: vi.fn(),
    invokeGetActiveWorkspace: vi.fn(),
    invokeImportWorkspaceKey: vi.fn(),
    invokeListWorkspaces: vi.fn(),
    invokeLoadWorkspaceCollections: vi.fn(),
    invokeRenameWorkspace: vi.fn(),
    invokeRenameWorkspaceCollection: vi.fn(),
    invokeSaveWorkspaceRequest: vi.fn(),
    WorkspaceCommandError: MockWorkspaceCommandError,
  };
});

const activateWorkspaceMock = vi.mocked(invokeActivateWorkspace);
const chooseDirectoryMock = vi.mocked(invokeChooseWorkspaceDirectory);
const createWorkspaceCollectionMock = vi.mocked(
  invokeCreateWorkspaceCollection,
);
const createWorkspaceMock = vi.mocked(invokeCreateWorkspace);
const deleteWorkspaceCollectionMock = vi.mocked(
  invokeDeleteWorkspaceCollection,
);
const deleteWorkspaceRequestMock = vi.mocked(invokeDeleteWorkspaceRequest);
const exportWorkspaceKeyMock = vi.mocked(invokeExportWorkspaceKey);
const getActiveWorkspaceMock = vi.mocked(invokeGetActiveWorkspace);
const importWorkspaceKeyMock = vi.mocked(invokeImportWorkspaceKey);
const listWorkspacesMock = vi.mocked(invokeListWorkspaces);
const loadWorkspaceCollectionsMock = vi.mocked(invokeLoadWorkspaceCollections);
const renameWorkspaceMock = vi.mocked(invokeRenameWorkspace);
const renameWorkspaceCollectionMock = vi.mocked(
  invokeRenameWorkspaceCollection,
);
const saveWorkspaceRequestMock = vi.mocked(invokeSaveWorkspaceRequest);

describe("workspace service", () => {
  beforeEach(() => {
    activateWorkspaceMock.mockReset();
    chooseDirectoryMock.mockReset();
    createWorkspaceCollectionMock.mockReset();
    createWorkspaceMock.mockReset();
    deleteWorkspaceCollectionMock.mockReset();
    deleteWorkspaceRequestMock.mockReset();
    exportWorkspaceKeyMock.mockReset();
    getActiveWorkspaceMock.mockReset();
    importWorkspaceKeyMock.mockReset();
    listWorkspacesMock.mockReset();
    loadWorkspaceCollectionsMock.mockReset();
    renameWorkspaceMock.mockReset();
    renameWorkspaceCollectionMock.mockReset();
    saveWorkspaceRequestMock.mockReset();
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

  it("normalizes and saves a request in a workspace collection", async () => {
    saveWorkspaceRequestMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [],
      request: {
        id: "request-1",
        name: "Todo",
        method: "GET",
        path: "https://example.com/todos/1",
        body: "",
      },
    });

    await saveWorkspaceRequest(" workspace-1 ", " Public API ", {
      id: null,
      name: " Todo ",
      method: "GET",
      path: " https://example.com/todos/1 ",
      body: "",
    });

    expect(saveWorkspaceRequestMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      collectionName: "Public API",
      request: {
        id: null,
        name: "Todo",
        method: "GET",
        path: "https://example.com/todos/1",
        body: "",
      },
    });
  });

  it("rejects unsupported request URLs before native persistence", async () => {
    await expect(
      saveWorkspaceRequest("workspace-1", "Public API", {
        id: null,
        name: "Local file",
        method: "GET",
        path: "file:///tmp/data.json",
        body: "",
      }),
    ).rejects.toMatchObject({
      code: "invalid_request_url",
    });
    expect(saveWorkspaceRequestMock).not.toHaveBeenCalled();
  });

  it("allows a well-formed environment variable URL template", async () => {
    saveWorkspaceRequestMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [],
      request: {
        id: "request-1",
        name: "Todo",
        method: "GET",
        path: "{{baseUrl}}/todos/1",
        body: "",
      },
    });

    await saveWorkspaceRequest("workspace-1", "Public API", {
      id: null,
      name: "Todo",
      method: "GET",
      path: "{{baseUrl}}/todos/1",
      body: "",
    });

    expect(saveWorkspaceRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ path: "{{baseUrl}}/todos/1" }),
      }),
    );
  });

  it("normalizes collection names before renaming", async () => {
    renameWorkspaceCollectionMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [],
    });

    await renameWorkspaceCollection(
      " workspace-1 ",
      " Public API ",
      " Internal API ",
    );

    expect(renameWorkspaceCollectionMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      currentName: "Public API",
      newName: "Internal API",
    });
  });

  it("normalizes collection names before creating them", async () => {
    createWorkspaceCollectionMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [{ name: "Empty API", requests: [] }],
    });

    await createWorkspaceCollection(" workspace-1 ", " Empty API ");

    expect(createWorkspaceCollectionMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      name: "Empty API",
    });
  });

  it("keeps workspace encryption key transfers inside the typed adapter", async () => {
    exportWorkspaceKeyMock.mockResolvedValue("/tmp/getrest-key.json");
    importWorkspaceKeyMock.mockResolvedValue(true);

    await expect(exportWorkspaceKey(" workspace-1 ")).resolves.toBe(
      "/tmp/getrest-key.json",
    );
    await expect(importWorkspaceKey(" workspace-1 ")).resolves.toBe(true);

    expect(exportWorkspaceKeyMock).toHaveBeenCalledWith("workspace-1");
    expect(importWorkspaceKeyMock).toHaveBeenCalledWith("workspace-1");
  });

  it("normalizes identifiers before deleting a request", async () => {
    deleteWorkspaceRequestMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [],
    });

    await deleteWorkspaceRequest(" workspace-1 ", " request-1 ");

    expect(deleteWorkspaceRequestMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      requestId: "request-1",
    });
  });

  it("normalizes collection names before deleting them", async () => {
    deleteWorkspaceCollectionMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [],
    });

    await deleteWorkspaceCollection(" workspace-1 ", " Public API ");

    expect(deleteWorkspaceCollectionMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      name: "Public API",
    });
  });
});
