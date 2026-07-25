import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const sendRestRequestMock = vi.hoisted(() => vi.fn());
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
    create: vi.fn(),
    getActive: vi.fn(),
    list: vi.fn(),
    loadCollections: vi.fn(),
    rename: vi.fn(),
    selectDirectory: vi.fn(),
    WorkspaceServiceError: MockWorkspaceServiceError,
  };
});

vi.mock("./services/restRequests", () => ({
  sendRestRequest: sendRestRequestMock,
}));
vi.mock("./services/workspaces", () => ({
  activateWorkspace: workspaceMocks.activate,
  createWorkspace: workspaceMocks.create,
  getActiveWorkspace: workspaceMocks.getActive,
  listWorkspaces: workspaceMocks.list,
  loadWorkspaceCollections: workspaceMocks.loadCollections,
  renameWorkspace: workspaceMocks.rename,
  selectWorkspaceDirectory: workspaceMocks.selectDirectory,
  WorkspaceServiceError: workspaceMocks.WorkspaceServiceError,
}));

describe("GetRest desktop shell", () => {
  beforeEach(() => {
    sendRestRequestMock.mockReset();
    workspaceMocks.activate.mockReset();
    workspaceMocks.create.mockReset();
    workspaceMocks.getActive.mockReset();
    workspaceMocks.list.mockReset();
    workspaceMocks.loadCollections.mockReset();
    workspaceMocks.rename.mockReset();
    workspaceMocks.selectDirectory.mockReset();
    workspaceMocks.getActive.mockResolvedValue(null);
    workspaceMocks.list.mockResolvedValue([]);
    workspaceMocks.loadCollections.mockResolvedValue([]);
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
      body: "",
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

  it("switches between request detail tabs", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Params" }));
    expect(screen.getByText("Query parameters")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add item" }),
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
});
