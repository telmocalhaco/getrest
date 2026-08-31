import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invokeChooseImportFiles,
  invokeImportWorkspaceData,
} from "../adapters/tauriWorkspaceAdapter";
import { importWorkspaceData } from "./workspaces";

vi.mock("../adapters/tauriWorkspaceAdapter", () => ({
  invokeChooseImportFiles: vi.fn(),
  invokeImportWorkspaceData: vi.fn(),
  WorkspaceCommandError: class extends Error {},
}));

const chooseFiles = vi.mocked(invokeChooseImportFiles);
const importData = vi.mocked(invokeImportWorkspaceData);
const result = {
  workspace: {
    id: "w1",
    name: "Test",
    path: "/tmp/test",
    gitState: "changes" as const,
    hasRemote: false,
  },
  collections: [],
  environments: [],
  importedCollections: 0,
  importedRequests: 0,
  importedEnvironments: 1,
};

describe("workspace environment import", () => {
  beforeEach(() => {
    chooseFiles.mockReset();
    importData.mockReset();
    importData.mockResolvedValue(result);
  });

  it("sends Hoppscotch initial values to native storage without importing collections", async () => {
    const variables = Array.from({ length: 17 }, (_, i) => ({
      key: `setting${i}`,
      secret: false,
      currentValue: "",
      initialValue: i < 14 ? `value${i}` : "",
    }));
    chooseFiles.mockResolvedValue([
      {
        name: "environment.json",
        content: JSON.stringify({ v: 2, name: "Test environment", variables }),
      },
    ]);
    await importWorkspaceData("w1", "environments");
    expect(importData).toHaveBeenCalledWith({
      workspaceId: "w1",
      collections: [],
      environments: [
        {
          name: "Test environment",
          variables: variables.map((v) => ({
            name: v.key,
            value: v.initialValue,
          })),
        },
      ],
    });
  });

  it("rejects a collection-only export without writing data", async () => {
    chooseFiles.mockResolvedValue([
      {
        name: "collection.json",
        content: JSON.stringify({
          name: "Collection",
          variables: [],
          folders: [],
          requests: [
            { name: "Get", method: "GET", endpoint: "https://example.com" },
          ],
        }),
      },
    ]);
    await expect(importWorkspaceData("w1", "environments")).rejects.toThrow(
      "do not contain environments",
    );
    expect(importData).not.toHaveBeenCalled();
  });

  it("imports only environments from a combined Yaak export", async () => {
    chooseFiles.mockResolvedValue([
      {
        name: "yaak.json",
        content: JSON.stringify({
          yaakSchema: 5,
          resources: {
            workspaces: [{ id: "w", name: "Test" }],
            httpRequests: [
              {
                workspaceId: "w",
                name: "Get",
                method: "GET",
                url: "https://example.com",
                authenticationType: "basic",
              },
            ],
            environments: [
              {
                name: "Local",
                variables: [
                  { name: "baseUrl", value: "https://example.com" },
                  { name: "token", value: "not-for-storage", secret: true },
                ],
              },
            ],
          },
        }),
      },
    ]);
    const imported = await importWorkspaceData("w1", "environments");
    expect(importData).toHaveBeenCalledWith({
      workspaceId: "w1",
      collections: [],
      environments: [
        {
          name: "Local",
          variables: [{ name: "baseUrl", value: "https://example.com" }],
        },
      ],
    });
    expect(imported).toMatchObject({
      skippedSecretVariables: 1,
      omittedFields: 0,
      skippedRequests: 0,
    });
  });

  it("does not write anything when file selection is cancelled", async () => {
    chooseFiles.mockResolvedValue([]);
    await expect(importWorkspaceData("w1", "environments")).resolves.toBeNull();
    expect(importData).not.toHaveBeenCalled();
  });

  it("reports invalid JSON without writing data", async () => {
    chooseFiles.mockResolvedValue([{ name: "bad.json", content: "{" }]);
    await expect(importWorkspaceData("w1", "environments")).rejects.toThrow(
      "not valid JSON",
    );
    expect(importData).not.toHaveBeenCalled();
  });
});
