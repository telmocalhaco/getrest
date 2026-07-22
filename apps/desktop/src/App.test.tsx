import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("GetRest desktop shell", () => {
  it("renders the initial request workspace", () => {
    render(<App />);
    expect(screen.getByText("GetRest")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Authenticate" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByLabelText("Response body")).toHaveTextContent(
      "Local developer",
    );
  });

  it("filters and selects requests", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Search requests"), "health");
    expect(
      screen.getByRole("button", { name: /Health check/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Authenticate/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Health check/ }));
    expect(
      screen.getByRole("heading", { name: "Health check" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("HTTP method")).toHaveValue("GET");
    expect(screen.getByLabelText("Request URL")).toHaveValue(
      "{{BASE_URL}}/v1/health",
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
});
