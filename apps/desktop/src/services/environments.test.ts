import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invokeDeleteWorkspaceEnvironment,
  invokeLoadWorkspaceEnvironments,
  invokeSaveWorkspaceEnvironment,
} from "../adapters/tauriEnvironmentAdapter";
import {
  deleteWorkspaceEnvironment,
  loadWorkspaceEnvironments,
  saveWorkspaceEnvironment,
} from "./environments";

vi.mock("../adapters/tauriEnvironmentAdapter", () => ({
  invokeDeleteWorkspaceEnvironment: vi.fn(),
  invokeLoadWorkspaceEnvironments: vi.fn(),
  invokeSaveWorkspaceEnvironment: vi.fn(),
}));

const deleteEnvironmentMock = vi.mocked(invokeDeleteWorkspaceEnvironment);
const loadEnvironmentsMock = vi.mocked(invokeLoadWorkspaceEnvironments);
const saveEnvironmentMock = vi.mocked(invokeSaveWorkspaceEnvironment);

describe("environment service", () => {
  beforeEach(() => {
    deleteEnvironmentMock.mockReset();
    loadEnvironmentsMock.mockReset();
    saveEnvironmentMock.mockReset();
  });

  it("loads environments for a normalized workspace id", async () => {
    loadEnvironmentsMock.mockResolvedValue([]);

    await loadWorkspaceEnvironments(" workspace-1 ");

    expect(loadEnvironmentsMock).toHaveBeenCalledWith("workspace-1");
  });

  it("normalizes and saves non-empty environment variables", async () => {
    saveEnvironmentMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        gitState: "changes",
        hasRemote: false,
      },
      environments: [],
      environment: { id: "environment-1", name: "Local", variables: [] },
    });

    await saveWorkspaceEnvironment(" workspace-1 ", {
      id: null,
      name: " Local ",
      variables: [
        { name: " baseUrl ", value: "http://localhost:3000" },
        { name: "", value: "" },
      ],
    });

    expect(saveEnvironmentMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      environment: {
        id: null,
        name: "Local",
        variables: [{ name: "baseUrl", value: "http://localhost:3000" }],
      },
    });
  });

  it("rejects invalid and duplicate variable names", async () => {
    await expect(
      saveWorkspaceEnvironment("workspace-1", {
        id: null,
        name: "Local",
        variables: [{ name: "invalid name", value: "value" }],
      }),
    ).rejects.toMatchObject({ code: "invalid_environment_variable" });
    await expect(
      saveWorkspaceEnvironment("workspace-1", {
        id: null,
        name: "Local",
        variables: [
          { name: "baseUrl", value: "one" },
          { name: "baseUrl", value: "two" },
        ],
      }),
    ).rejects.toMatchObject({ code: "duplicate_environment_variable" });

    expect(saveEnvironmentMock).not.toHaveBeenCalled();
  });

  it("normalizes identifiers before deleting an environment", async () => {
    deleteEnvironmentMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        gitState: "changes",
        hasRemote: false,
      },
      environments: [],
    });

    await deleteWorkspaceEnvironment(" workspace-1 ", " environment-1 ");

    expect(deleteEnvironmentMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      environmentId: "environment-1",
    });
  });

  it("rejects reserved names and oversized names before persistence", async () => {
    for (const name of [
      "__proto__",
      "constructor",
      "prototype",
      "Constructor",
      "PROTOTYPE",
      "__PROTO__",
    ]) {
      await expect(
        saveWorkspaceEnvironment("workspace-1", {
          id: null,
          name: "Local",
          variables: [{ name, value: "test-value" }],
        }),
      ).rejects.toMatchObject({ code: "reserved_environment_variable" });
    }
    await expect(
      saveWorkspaceEnvironment("workspace-1", {
        id: null,
        name: "Local",
        variables: [{ name: "a".repeat(101), value: "test-value" }],
      }),
    ).rejects.toMatchObject({ code: "invalid_environment_variable" });
    expect(saveEnvironmentMock).not.toHaveBeenCalled();
  });
});
