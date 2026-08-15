import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeCollectionRun } from "../adapters/tauriRunnerAdapter";
import { runCollection } from "./collectionRunner";

vi.mock("../adapters/tauriRunnerAdapter", () => ({
  invokeCollectionRun: vi.fn(),
}));

const step = {
  requestId: "one",
  name: "One",
  method: "GET",
  url: "https://example.com",
  body: "",
  extractors: [],
};

describe("collection runner service", () => {
  beforeEach(() => vi.mocked(invokeCollectionRun).mockReset());

  it("rejects unsafe request totals before invoking Rust", async () => {
    await expect(
      runCollection({
        steps: [step],
        variables: [],
        virtualUsers: 50,
        iterations: 201,
        thinkTimeMs: 0,
      }),
    ).rejects.toThrow("10,000");
    expect(invokeCollectionRun).not.toHaveBeenCalled();
  });

  it("passes a bounded run to the native adapter", async () => {
    const result = {
      totalRequests: 1,
      passedRequests: 1,
      failedRequests: 0,
      durationMs: 10,
      requestsPerSecond: 100,
      averageDurationMs: 10,
      p95DurationMs: 10,
      steps: [],
      errors: [],
    };
    vi.mocked(invokeCollectionRun).mockResolvedValue(result);
    await expect(
      runCollection({
        steps: [step],
        variables: [],
        virtualUsers: 1,
        iterations: 1,
        thinkTimeMs: 0,
      }),
    ).resolves.toEqual(result);
  });
});
