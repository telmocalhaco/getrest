import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const sendRestRequestMock = vi.hoisted(() => vi.fn());
const environmentMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
}));
const workspaceMocks = vi.hoisted(() => {
  class MockWorkspaceServiceError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }

  return {
    activate: vi.fn(),
    createCollection: vi.fn(),
    create: vi.fn(),
    deleteCollection: vi.fn(),
    deleteRequest: vi.fn(),
    exportKey: vi.fn(),
    getActive: vi.fn(),
    importKey: vi.fn(),
    importData: vi.fn(),
    list: vi.fn(),
    loadCollections: vi.fn(),
    rename: vi.fn(),
    renameCollection: vi.fn(),
    saveRequest: vi.fn(),
    selectDirectory: vi.fn(),
    WorkspaceServiceError: MockWorkspaceServiceError,
  };
});

vi.mock("./services/restRequests", () => ({
  sendRestRequest: sendRestRequestMock,
}));
vi.mock("./services/environments", () => ({
  deleteWorkspaceEnvironment: environmentMocks.delete,
  loadWorkspaceEnvironments: environmentMocks.load,
  saveWorkspaceEnvironment: environmentMocks.save,
}));
vi.mock("./services/workspaces", () => ({
  activateWorkspace: workspaceMocks.activate,
  createWorkspaceCollection: workspaceMocks.createCollection,
  createWorkspace: workspaceMocks.create,
  deleteWorkspaceCollection: workspaceMocks.deleteCollection,
  deleteWorkspaceRequest: workspaceMocks.deleteRequest,
  exportWorkspaceKey: workspaceMocks.exportKey,
  getActiveWorkspace: workspaceMocks.getActive,
  importWorkspaceKey: workspaceMocks.importKey,
  importWorkspaceData: workspaceMocks.importData,
  listWorkspaces: workspaceMocks.list,
  loadWorkspaceCollections: workspaceMocks.loadCollections,
  renameWorkspace: workspaceMocks.rename,
  renameWorkspaceCollection: workspaceMocks.renameCollection,
  saveWorkspaceRequest: workspaceMocks.saveRequest,
  selectWorkspaceDirectory: workspaceMocks.selectDirectory,
  WorkspaceServiceError: workspaceMocks.WorkspaceServiceError,
}));

describe("GetRest desktop shell", () => {
  beforeEach(() => {
    sendRestRequestMock.mockReset();
    environmentMocks.delete.mockReset();
    environmentMocks.load.mockReset();
    environmentMocks.save.mockReset();
    workspaceMocks.activate.mockReset();
    workspaceMocks.createCollection.mockReset();
    workspaceMocks.create.mockReset();
    workspaceMocks.deleteCollection.mockReset();
    workspaceMocks.deleteRequest.mockReset();
    workspaceMocks.exportKey.mockReset();
    workspaceMocks.getActive.mockReset();
    workspaceMocks.importKey.mockReset();
    workspaceMocks.importData.mockReset();
    workspaceMocks.list.mockReset();
    workspaceMocks.loadCollections.mockReset();
    workspaceMocks.rename.mockReset();
    workspaceMocks.renameCollection.mockReset();
    workspaceMocks.saveRequest.mockReset();
    workspaceMocks.selectDirectory.mockReset();
    workspaceMocks.getActive.mockResolvedValue(null);
    workspaceMocks.exportKey.mockResolvedValue(null);
    workspaceMocks.importKey.mockResolvedValue(false);
    workspaceMocks.importData.mockResolvedValue(null);
    workspaceMocks.list.mockResolvedValue([]);
    workspaceMocks.loadCollections.mockResolvedValue([]);
    environmentMocks.load.mockResolvedValue([]);
    workspaceMocks.selectDirectory.mockResolvedValue(
      "/tmp/getrest-demo-workspace",
    );
    workspaceMocks.create.mockResolvedValue({
      id: "workspace-1",
      name: "getrest-demo-workspace",
      path: "/tmp/getrest-demo-workspace",
      gitState: "localOnly",
      hasRemote: false,
    });
    workspaceMocks.saveRequest.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "getrest-demo-workspace",
        path: "/tmp/getrest-demo-workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [
        {
          name: "Public API",
          requests: [
            {
              id: "todo",
              name: "Todo details",
              method: "GET",
              path: "https://jsonplaceholder.typicode.com/todos/1",
              body: "",
            },
          ],
        },
      ],
      request: {
        id: "todo",
        name: "Todo details",
        method: "GET",
        path: "https://jsonplaceholder.typicode.com/todos/1",
        body: "",
        headers: [],
      },
    });
    workspaceMocks.renameCollection.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "getrest-demo-workspace",
        path: "/tmp/getrest-demo-workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [
        {
          name: "Internal API",
          requests: [
            {
              id: "todo",
              name: "Todo details",
              method: "GET",
              path: "https://jsonplaceholder.typicode.com/todos/1",
              body: "",
            },
          ],
        },
      ],
    });
    workspaceMocks.createCollection.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "getrest-demo-workspace",
        path: "/tmp/getrest-demo-workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [
        {
          name: "Public API",
          requests: [
            {
              id: "todo",
              name: "Todo details",
              method: "GET",
              path: "https://jsonplaceholder.typicode.com/todos/1",
              body: "",
            },
          ],
        },
        { name: "Empty API", requests: [] },
      ],
    });
    workspaceMocks.deleteRequest.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "getrest-demo-workspace",
        path: "/tmp/getrest-demo-workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [{ name: "Public API", requests: [] }],
    });
    workspaceMocks.deleteCollection.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "getrest-demo-workspace",
        path: "/tmp/getrest-demo-workspace",
        gitState: "changes",
        hasRemote: false,
      },
      collections: [],
    });
    environmentMocks.save.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "getrest-demo-workspace",
        path: "/tmp/getrest-demo-workspace",
        gitState: "changes",
        hasRemote: false,
      },
      environments: [
        {
          id: "environment-1",
          name: "Local",
          variables: [{ name: "baseUrl", value: "http://localhost:3000" }],
        },
      ],
      environment: {
        id: "environment-1",
        name: "Local",
        variables: [{ name: "baseUrl", value: "http://localhost:3000" }],
      },
    });
    sendRestRequestMock.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: [
        { name: "content-type", value: "application/json; charset=utf-8" },
      ],
      body: JSON.stringify({
        userId: 1,
        id: 1,
        title: "delectus aut autem",
        completed: false,
      }),
      durationMs: 42,
      sizeBytes: 83,
      contentType: "application/json; charset=utf-8",
    });
  });

  it("renders the initial request workspace", () => {
    render(<App />);
    expect(screen.getByText("GetRest")).toBeInTheDocument();
    expect(screen.getByLabelText("Application version")).toHaveTextContent(
      "v0.1.0",
    );
    expect(
      screen.getByRole("heading", { name: "Todo details" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByLabelText("Request URL")).toHaveValue(
      "https://jsonplaceholder.typicode.com/todos/1",
    );
    expect(
      screen.getByText("Send a request to view its response"),
    ).toBeInTheDocument();
  });

  it("sends a request and renders the native response", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(sendRestRequestMock).toHaveBeenCalledWith({
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/todos/1",
      headers: [],
      body: "",
      variables: [],
    });
    expect(await screen.findByText("200 OK")).toBeInTheDocument();
    expect(screen.getByLabelText("Response body")).toHaveTextContent(
      "delectus aut autem",
    );

    await user.click(
      within(
        screen.getByRole("tablist", { name: "Response details" }),
      ).getByRole("tab", { name: /Headers/ }),
    );
    expect(screen.getByLabelText("Response headers")).toHaveTextContent(
      "content-type",
    );
  });

  it("filters and selects requests", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Search requests"), "recent");
    expect(
      screen.getByRole("button", { name: /Recent posts/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Todo details/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Recent posts/ }));
    expect(
      screen.getByRole("heading", { name: "Recent posts" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("HTTP method")).toHaveValue("GET");
    expect(screen.getByLabelText("Request URL")).toHaveValue(
      "https://jsonplaceholder.typicode.com/posts?_limit=5",
    );
  });

  it("sends the active environment variables with a templated request", async () => {
    workspaceMocks.getActive.mockResolvedValue({
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "clean",
      hasRemote: false,
    });
    workspaceMocks.loadCollections.mockResolvedValue([
      {
        name: "Public API",
        requests: [
          {
            id: "todo",
            name: "Todo details",
            method: "POST",
            path: "{{baseUrl}}/todos",
            body: '{"user":"{{userId}}"}',
          },
        ],
      },
    ]);
    environmentMocks.load.mockResolvedValue([
      {
        id: "environment-1",
        name: "Development",
        variables: [
          { name: "baseUrl", value: "https://dev.example.com" },
          { name: "userId", value: "42" },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Todo details" });
    expect(screen.getByLabelText("Active environment")).toHaveValue(
      "environment-1",
    );
    expect(screen.getByText("{{baseUrl}}")).toHaveClass(
      "template-variable",
      "defined",
    );
    expect(screen.getByText("{{userId}}")).toHaveClass(
      "template-variable",
      "defined",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(sendRestRequestMock).toHaveBeenCalledWith({
      method: "POST",
      url: "{{baseUrl}}/todos",
      headers: [],
      body: '{"user":"{{userId}}"}',
      variables: [
        { name: "baseUrl", value: "https://dev.example.com" },
        { name: "userId", value: "42" },
      ],
    });
  });

  it("creates a workspace environment from the management dialog", async () => {
    workspaceMocks.getActive.mockResolvedValue({
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "clean",
      hasRemote: false,
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: "Demo workspace" });
    await user.click(
      screen.getByRole("button", { name: "Manage environments" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Environments" });
    await user.type(within(dialog).getByLabelText("Environment name"), "Local");
    await user.type(
      within(dialog).getByLabelText("Variable name 1"),
      "baseUrl",
    );
    await user.type(
      within(dialog).getByLabelText("Variable value 1"),
      "http://localhost:3000",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save environment" }),
    );

    expect(environmentMocks.save).toHaveBeenCalledWith("workspace-1", {
      id: null,
      name: "Local",
      variables: [{ name: "baseUrl", value: "http://localhost:3000" }],
    });
    expect(await screen.findByLabelText("Active environment")).toHaveValue(
      "environment-1",
    );
  });

  it("switches between request detail tabs", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Params" }));
    expect(screen.getByText("Query parameters")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add item" }),
    ).toBeInTheDocument();
  });

  it("adds, removes, and sends request headers", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      within(
        screen.getByRole("tablist", { name: "Request details" }),
      ).getByRole("tab", { name: "Headers" }),
    );
    await user.click(screen.getByRole("button", { name: "Add header" }));
    await user.type(screen.getByLabelText("Header 1 name"), "X-Client");
    await user.type(screen.getByLabelText("Header 1 value"), "GetRest");
    await user.click(screen.getByRole("button", { name: "Add header" }));
    await user.type(screen.getByLabelText("Header 2 name"), "X-Remove");
    await user.click(screen.getByLabelText("Remove header 2"));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(sendRestRequestMock).toHaveBeenCalledWith({
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/todos/1",
      headers: [{ name: "X-Client", value: "GetRest" }],
      body: "",
      variables: [],
    });
    expect(
      within(
        screen.getByRole("tablist", { name: "Request details" }),
      ).getByRole("tab", { name: /Headers 1/ }),
    ).toBeInTheDocument();
  });

  it("shows native request errors without exposing implementation details", async () => {
    sendRestRequestMock.mockRejectedValueOnce(
      new Error("The remote API could not be reached."),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("The remote API could not be reached."),
    ).toBeInTheDocument();
    expect(screen.getByText("Request failed")).toBeInTheDocument();
  });

  it("saves the current request in a workspace collection", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.loadCollections.mockResolvedValue([
      {
        name: "Public API",
        requests: [
          {
            id: "todo",
            name: "Todo details",
            method: "GET",
            path: "https://jsonplaceholder.typicode.com/todos/1",
            body: "",
          },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Todo details" });
    await user.click(
      within(
        screen.getByRole("tablist", { name: "Request details" }),
      ).getByRole("tab", { name: "Headers" }),
    );
    await user.click(screen.getByRole("button", { name: "Add header" }));
    await user.type(screen.getByLabelText("Header 1 name"), "Authorization");
    await user.type(
      screen.getByLabelText("Header 1 value"),
      "Bearer private-token",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = screen.getByRole("dialog", { name: "Save request" });
    const nameInput = within(dialog).getByLabelText("Request name");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated todo");
    await user.click(
      within(dialog).getByRole("button", { name: "Save request" }),
    );

    expect(workspaceMocks.saveRequest).toHaveBeenCalledWith(
      "workspace-1",
      "Public API",
      {
        id: "todo",
        name: "Updated todo",
        method: "GET",
        path: "https://jsonplaceholder.typicode.com/todos/1",
        body: "",
        headers: [{ name: "Authorization", value: "Bearer private-token" }],
      },
    );
    expect(
      await screen.findByRole("button", { name: /Changes not committed/ }),
    ).toBeVisible();
  });

  it("renames the selected request through the explicit action", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.loadCollections.mockResolvedValue([
      {
        name: "Public API",
        requests: [
          {
            id: "todo",
            name: "Todo details",
            method: "GET",
            path: "https://jsonplaceholder.typicode.com/todos/1",
            body: "",
          },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Todo details" });
    await user.click(screen.getByRole("button", { name: "Request options" }));
    await user.click(screen.getByRole("menuitem", { name: /Rename request/ }));
    const dialog = screen.getByRole("dialog", { name: "Rename request" });
    const nameInput = within(dialog).getByLabelText("Request name");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed todo");
    await user.click(
      within(dialog).getByRole("button", { name: "Rename request" }),
    );

    expect(workspaceMocks.saveRequest).toHaveBeenCalledWith(
      "workspace-1",
      "Public API",
      expect.objectContaining({
        id: "todo",
        name: "Renamed todo",
      }),
    );
  });

  it("starts a new unsaved request from the request menu", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.loadCollections.mockResolvedValue([
      {
        name: "Public API",
        requests: [
          {
            id: "todo",
            name: "Todo details",
            method: "GET",
            path: "https://jsonplaceholder.typicode.com/todos/1",
            body: "",
          },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Todo details" });
    await user.click(screen.getByRole("button", { name: "Request options" }));
    await user.click(screen.getByRole("menuitem", { name: /New request/ }));

    expect(screen.getByRole("heading", { name: "New request" })).toBeVisible();
    expect(screen.getByLabelText("Request URL")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(
      screen.getByLabelText("Request URL"),
      "https://example.com/health",
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("renames a selected workspace collection", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.loadCollections.mockResolvedValue([
      {
        name: "Public API",
        requests: [
          {
            id: "todo",
            name: "Todo details",
            method: "GET",
            path: "https://jsonplaceholder.typicode.com/todos/1",
            body: "",
          },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Todo details" });
    await user.click(
      screen.getByRole("button", { name: "Collection options" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /Rename collection/ }),
    );
    const dialog = screen.getByRole("dialog", { name: "Rename collection" });
    const nameInput = within(dialog).getByLabelText("New collection name");
    await user.clear(nameInput);
    await user.type(nameInput, "Internal API");
    await user.click(
      within(dialog).getByRole("button", { name: "Rename collection" }),
    );

    expect(workspaceMocks.renameCollection).toHaveBeenCalledWith(
      "workspace-1",
      "Public API",
      "Internal API",
    );
    expect(
      await screen.findByRole("button", { name: /Internal API/ }),
    ).toBeVisible();
  });

  it("creates and keeps an empty workspace collection", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.loadCollections.mockResolvedValue([
      {
        name: "Public API",
        requests: [
          {
            id: "todo",
            name: "Todo details",
            method: "GET",
            path: "https://jsonplaceholder.typicode.com/todos/1",
            body: "",
          },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Todo details" });
    await user.click(
      screen.getByRole("button", { name: "Collection options" }),
    );
    await user.click(screen.getByRole("menuitem", { name: /New collection/ }));
    const dialog = screen.getByRole("dialog", { name: "Create collection" });
    await user.type(
      within(dialog).getByLabelText("Collection name"),
      "Empty API",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create collection" }),
    );

    expect(workspaceMocks.createCollection).toHaveBeenCalledWith(
      "workspace-1",
      "Empty API",
    );
    expect(
      await screen.findByRole("button", { name: /Empty API 0/ }),
    ).toBeVisible();
  });

  it("deletes a saved request after explicit confirmation", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.loadCollections.mockResolvedValue([
      {
        name: "Public API",
        requests: [
          {
            id: "todo",
            name: "Todo details",
            method: "GET",
            path: "https://jsonplaceholder.typicode.com/todos/1",
            body: "",
          },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Todo details" });
    await user.click(screen.getByRole("button", { name: "Request options" }));
    await user.click(screen.getByRole("menuitem", { name: /Delete request/ }));
    const dialog = screen.getByRole("dialog", { name: "Delete request" });
    expect(within(dialog).getByText(/Todo details/)).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Delete request" }),
    );

    expect(workspaceMocks.deleteRequest).toHaveBeenCalledWith(
      "workspace-1",
      "todo",
    );
    expect(
      await screen.findByRole("heading", { name: "New request" }),
    ).toBeVisible();
  });

  it("deletes a collection and warns about its contained requests", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.loadCollections.mockResolvedValue([
      {
        name: "Public API",
        requests: [
          {
            id: "todo",
            name: "Todo details",
            method: "GET",
            path: "https://jsonplaceholder.typicode.com/todos/1",
            body: "",
          },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Todo details" });
    await user.click(
      screen.getByRole("button", { name: "Collection options" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /Delete collection/ }),
    );
    const dialog = screen.getByRole("dialog", { name: "Delete collection" });
    expect(within(dialog).getByText(/1 contained request/)).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Delete collection" }),
    );

    expect(workspaceMocks.deleteCollection).toHaveBeenCalledWith(
      "workspace-1",
      "Public API",
    );
    expect(
      await screen.findByRole("heading", { name: "New request" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Public API/ }),
    ).not.toBeInTheDocument();
  });

  it("can select and delete an empty collection", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Demo workspace",
      path: "/tmp/demo-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.loadCollections.mockResolvedValue([
      {
        name: "Public API",
        requests: [
          {
            id: "todo",
            name: "Todo details",
            method: "GET",
            path: "https://jsonplaceholder.typicode.com/todos/1",
            body: "",
          },
        ],
      },
      { name: "Empty API", requests: [] },
    ]);
    workspaceMocks.deleteCollection.mockResolvedValueOnce({
      workspace: {
        ...activeWorkspace,
        gitState: "changes",
      },
      collections: [
        {
          name: "Public API",
          requests: [
            {
              id: "todo",
              name: "Todo details",
              method: "GET",
              path: "https://jsonplaceholder.typicode.com/todos/1",
              body: "",
            },
          ],
        },
      ],
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Todo details" });
    await user.click(
      screen.getByRole("button", { name: "Collection options" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /Delete collection/ }),
    );
    const dialog = screen.getByRole("dialog", { name: "Delete collection" });
    await user.selectOptions(
      within(dialog).getByLabelText("Collection to delete"),
      "Empty API",
    );
    expect(within(dialog).getByText(/0 contained requests/)).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Delete collection" }),
    );

    expect(workspaceMocks.deleteCollection).toHaveBeenCalledWith(
      "workspace-1",
      "Empty API",
    );
  });

  it("creates a dedicated local workspace from a selected folder", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    const dialog = screen.getByRole("dialog", { name: "Create workspace" });
    await user.click(
      within(dialog).getByRole("button", { name: "Choose folder" }),
    );
    expect(await screen.findByLabelText("Workspace folder")).toHaveValue(
      "/tmp/getrest-demo-workspace",
    );

    await user.click(
      within(dialog).getByRole("button", { name: "Create workspace" }),
    );

    expect(workspaceMocks.create).toHaveBeenCalledWith(
      "/tmp/getrest-demo-workspace",
      null,
      [
        {
          name: "Public API",
          requests: expect.arrayContaining([
            expect.objectContaining({ id: "todo", method: "GET" }),
          ]),
        },
      ],
    );
    expect(
      await screen.findByRole("button", { name: "getrest-demo-workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Local only/ })).toBeVisible();
  });

  it("requests a repository-local Git identity when needed", async () => {
    workspaceMocks.create
      .mockRejectedValueOnce(
        new workspaceMocks.WorkspaceServiceError(
          "git_identity_required",
          "Enter the Git author name and email.",
        ),
      )
      .mockResolvedValueOnce({
        id: "workspace-1",
        name: "getrest-demo-workspace",
        path: "/tmp/getrest-demo-workspace",
        gitState: "localOnly",
        hasRemote: false,
      });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    const dialog = screen.getByRole("dialog", { name: "Create workspace" });
    await user.click(
      within(dialog).getByRole("button", { name: "Choose folder" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create workspace" }),
    );

    await user.type(
      await screen.findByLabelText("Git author name"),
      "GetRest User",
    );
    await user.type(
      screen.getByLabelText("Git author email"),
      "user@example.com",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create workspace" }),
    );

    expect(workspaceMocks.create).toHaveBeenLastCalledWith(
      "/tmp/getrest-demo-workspace",
      { name: "GetRest User", email: "user@example.com" },
      expect.any(Array),
    );
  });

  it("can create an empty workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    const dialog = screen.getByRole("dialog", { name: "Create workspace" });
    await user.click(
      within(dialog).getByRole("button", { name: "Choose folder" }),
    );
    await user.click(
      within(dialog).getByRole("radio", {
        name: /Start with an empty workspace/,
      }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create workspace" }),
    );

    expect(workspaceMocks.create).toHaveBeenCalledWith(
      "/tmp/getrest-demo-workspace",
      null,
      [],
    );
    expect(await screen.findByText("No requests found.")).toBeInTheDocument();
  });

  it("renames the active workspace and offers another workspace", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Current workspace",
      path: "/tmp/current-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.list.mockResolvedValue([activeWorkspace]);
    workspaceMocks.rename.mockResolvedValue({
      ...activeWorkspace,
      name: "Renamed workspace",
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Current workspace" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Workspaces" });
    const nameInput = within(dialog).getByLabelText("Workspace name");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed workspace");
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));

    expect(workspaceMocks.rename).toHaveBeenCalledWith(
      "workspace-1",
      "Renamed workspace",
    );
    expect(
      await screen.findByRole("button", { name: "Renamed workspace" }),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", {
        name: /Create a new workspace/,
      }),
    );
    expect(
      screen.getByRole("dialog", { name: "Create workspace" }),
    ).toBeInTheDocument();
  });

  it("imports external collections and environments into an empty workspace", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Imported workspace",
      path: "/tmp/imported-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.importData.mockResolvedValue({
      workspace: { ...activeWorkspace, gitState: "changes" as const },
      collections: [
        {
          name: "Orders",
          requests: [
            {
              id: "request-1",
              name: "List orders",
              method: "GET",
              path: "https://example.com/orders",
              body: "",
              headers: [],
            },
          ],
        },
      ],
      environments: [
        {
          id: "environment-1",
          name: "Production",
          variables: [{ name: "baseUrl", value: "https://example.com" }],
        },
      ],
      importedCollections: 1,
      importedRequests: 1,
      importedEnvironments: 1,
      skippedRequests: 0,
      skippedVariables: 0,
      skippedSecretVariables: 1,
      omittedFields: 0,
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Collection options" }),
    );
    await user.click(screen.getByRole("menuitem", { name: /Import data/ }));

    expect(workspaceMocks.importData).toHaveBeenCalledWith("workspace-1");
    expect((await screen.findAllByText("List orders")).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(/1 secret value\(s\) omitted/)).toBeInTheDocument();
  });

  it("exports and imports the active workspace encryption key", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Private workspace",
      path: "/tmp/private-workspace",
      gitState: "localOnly" as const,
      hasRemote: false,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.list.mockResolvedValue([activeWorkspace]);
    workspaceMocks.exportKey.mockResolvedValue("/tmp/private-key.json");
    workspaceMocks.importKey.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Private workspace" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Workspaces" });
    await user.click(
      within(dialog).getByRole("button", { name: "Export key" }),
    );
    expect(workspaceMocks.exportKey).toHaveBeenCalledWith("workspace-1");
    expect(
      await within(dialog).findByText(/private-key\.json/),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "Import key" }),
    );
    expect(workspaceMocks.importKey).toHaveBeenCalledWith("workspace-1");
    expect(
      await within(dialog).findByText("Encryption key imported successfully."),
    ).toBeInTheDocument();
  });

  it("keeps a protected workspace available while its key is missing", async () => {
    const activeWorkspace = {
      id: "workspace-1",
      name: "Shared workspace",
      path: "/tmp/shared-workspace",
      gitState: "clean" as const,
      hasRemote: true,
    };
    workspaceMocks.getActive.mockResolvedValue(activeWorkspace);
    workspaceMocks.list.mockResolvedValue([activeWorkspace]);
    workspaceMocks.loadCollections
      .mockRejectedValueOnce(
        new Error(
          "Import this workspace's encryption key to read its protected values.",
        ),
      )
      .mockResolvedValueOnce([
        {
          name: "Private API",
          requests: [
            {
              id: "private-request",
              name: "Private request",
              method: "GET",
              path: "https://example.com/private",
              body: "",
              headers: [{ name: "Authorization", value: "Bearer restored" }],
            },
          ],
        },
      ]);
    workspaceMocks.importKey.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Shared workspace" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Workspaces" });
    expect(
      await within(dialog).findByText(/Import this workspace's encryption key/),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "Import key" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Private request" }),
    ).toBeInTheDocument();
    await user.click(
      within(
        screen.getByRole("tablist", { name: "Request details" }),
      ).getByRole("tab", { name: /Headers 1/ }),
    );
    expect(screen.getByLabelText("Header 1 value")).toHaveValue(
      "Bearer restored",
    );
  });
});
