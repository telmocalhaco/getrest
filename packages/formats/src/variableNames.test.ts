import { describe, expect, it } from "vitest";
import { parseImportFiles, variableNameError } from "./index";

describe("environment variable names", () => {
  it("allows header names and enforces the syntax and length limits", () => {
    for (const name of [
      "baseUrl",
      "X-Auth-Hash",
      "Content-Type",
      "Authorization",
      "_user",
      "item.id",
      "a".repeat(100),
    ]) {
      expect(variableNameError(name)).toBeNull();
    }
    for (const name of [
      "",
      "invalid name",
      "1name",
      "name\n",
      "{{name}}",
      "naïve",
      "a".repeat(101),
    ]) {
      expect(variableNameError(name)).toBe("invalid");
    }
  });

  it("rejects technical names regardless of letter case", () => {
    for (const name of [
      "__proto__",
      "constructor",
      "prototype",
      "Constructor",
      "PROTOTYPE",
      "__PROTO__",
    ]) {
      expect(variableNameError(name)).toBe("reserved");
    }
  });

  it("skips reserved and invalid names during an environment import", () => {
    const parsed = parseImportFiles([
      {
        name: "environment.json",
        content: JSON.stringify({
          _postman_variable_scope: "environment",
          name: "Development",
          values: [
            "__proto__",
            "Constructor",
            "prototype",
            "invalid name",
            "X-Auth-Hash",
            "Authorization",
          ].map((key) => ({ key, value: "test-value", enabled: true })),
        }),
      },
    ]);
    expect(parsed.skippedVariables).toBe(4);
    expect(parsed.environments[0].variables).toEqual([
      { name: "X-Auth-Hash", value: "test-value" },
      { name: "Authorization", value: "test-value" },
    ]);
  });
});
