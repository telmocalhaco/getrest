import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeRestRequest } from "../adapters/tauriRestAdapter";
import { sendRestRequest } from "./restRequests";

vi.mock("../adapters/tauriRestAdapter", () => ({
  invokeRestRequest: vi.fn(),
}));

const invokeRestRequestMock = vi.mocked(invokeRestRequest);

describe("REST request service", () => {
  beforeEach(() => {
    invokeRestRequestMock.mockReset();
    invokeRestRequestMock.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: [],
      body: "{}",
      durationMs: 10,
      sizeBytes: 2,
      contentType: "application/json",
    });
  });

  it("normalizes and forwards an HTTPS GET request", async () => {
    await sendRestRequest({
      method: "GET",
      url: " https://example.com/todos/1 ",
      body: "ignored",
    });

    expect(invokeRestRequestMock).toHaveBeenCalledWith({
      method: "GET",
      url: "https://example.com/todos/1",
      headers: [],
      body: null,
    });
  });

  it("adds a JSON content type when sending a body", async () => {
    await sendRestRequest({
      method: "POST",
      url: "https://example.com/posts",
      body: '{ "title": "GetRest" }',
    });

    expect(invokeRestRequestMock).toHaveBeenCalledWith({
      method: "POST",
      url: "https://example.com/posts",
      headers: [{ name: "content-type", value: "application/json" }],
      body: '{ "title": "GetRest" }',
    });
  });

  it("rejects invalid and unsupported URLs before invoking Tauri", async () => {
    await expect(
      sendRestRequest({ method: "GET", url: "not a url", body: "" }),
    ).rejects.toThrow("Enter a valid request URL.");
    await expect(
      sendRestRequest({
        method: "GET",
        url: "file:///tmp/request.json",
        body: "",
      }),
    ).rejects.toThrow("Only HTTP and HTTPS request URLs are supported.");

    expect(invokeRestRequestMock).not.toHaveBeenCalled();
  });
});
