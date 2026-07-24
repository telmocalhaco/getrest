import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const sendRestRequestMock = vi.hoisted(() => vi.fn());

vi.mock("./services/restRequests", () => ({
  sendRestRequest: sendRestRequestMock,
}));

describe("GetRest desktop shell", () => {
  beforeEach(() => {
    sendRestRequestMock.mockReset();
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
});
