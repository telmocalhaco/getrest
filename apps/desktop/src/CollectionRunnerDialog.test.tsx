import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CollectionRunnerDialog } from "./CollectionRunnerDialog";

vi.mock("./services/collectionRunner", () => ({ runCollection: vi.fn() }));

const requests = [
  {
    id: "first",
    name: "Create",
    method: "POST" as const,
    path: "https://example.com/users",
    collection: "Users",
    body: "{}",
  },
  {
    id: "second",
    name: "Read",
    method: "GET" as const,
    path: "https://example.com/users/{{userId}}",
    collection: "Users",
    body: "",
  },
];

describe("CollectionRunnerDialog", () => {
  it("allows users to reorder the flow and configure extraction", async () => {
    const user = userEvent.setup();
    render(
      <CollectionRunnerDialog
        collections={["Users"]}
        initialCollection="Users"
        onClose={vi.fn()}
        requests={requests}
        variables={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Move Create down" }));
    const stepNames = screen
      .getAllByText(/^(Create|Read)$/)
      .map((element) => element.textContent);
    expect(stepNames).toEqual(["Read", "Create"]);

    await user.click(
      screen.getAllByRole("button", { name: "+ Extract response value" })[1],
    );
    await user.type(
      screen.getByLabelText("Create extracted variable 1"),
      "userId",
    );
    await user.type(screen.getByLabelText("Create JSON path 1"), "data.id");
    expect(screen.getByText("{{userId}}", { exact: true })).toBeInTheDocument();
  });

  it("requires explicit authorization before a load run", async () => {
    const user = userEvent.setup();
    render(
      <CollectionRunnerDialog
        collections={["Users"]}
        initialCollection="Users"
        onClose={vi.fn()}
        requests={requests}
        variables={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Load / stress" }));
    expect(
      screen.getByRole("button", { name: "Start load test" }),
    ).toBeDisabled();
    await user.click(screen.getByText(/I confirm that I own/));
    expect(
      screen.getByRole("button", { name: "Start load test" }),
    ).toBeEnabled();
  });
});
