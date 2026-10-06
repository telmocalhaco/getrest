import { describe, expect, it } from "vitest";
import { parseImportFiles } from "./index";

describe("external format imports", () => {
  it("imports nested Postman collections and excludes secret environment values", () => {
    const parsed = parseImportFiles([
      {
        name: "api.postman_collection.json",
        content: JSON.stringify({
          info: { name: "Orders" },
          item: [
            {
              name: "Admin",
              item: [
                {
                  name: "List orders",
                  request: {
                    method: "GET",
                    url: { raw: "{{baseUrl}}/orders" },
                    header: [{ key: "X-Token", value: "{{token}}" }],
                  },
                },
              ],
            },
          ],
        }),
      },
      {
        name: "local.postman_environment.json",
        content: JSON.stringify({
          name: "Local",
          values: [
            { key: "baseUrl", value: "http://localhost:3000", enabled: true },
            { key: "token", value: "do-not-persist", type: "secret" },
          ],
        }),
      },
    ]);

    expect(parsed.collections).toEqual([
      {
        name: "Orders / Admin",
        requests: [
          {
            name: "List orders",
            method: "GET",
            path: "{{baseUrl}}/orders",
            body: "",
            headers: [{ name: "X-Token", value: "{{token}}" }],
          },
        ],
      },
    ]);
    expect(parsed.environments).toEqual([
      {
        name: "Local",
        variables: [{ name: "baseUrl", value: "http://localhost:3000" }],
      },
    ]);
    expect(parsed.skippedSecretVariables).toBe(1);
  });

  it("imports Hoppscotch collection and environment exports", () => {
    const parsed = parseImportFiles([
      {
        name: "hoppscotch.json",
        content: JSON.stringify([
          {
            name: "Users",
            folders: [],
            requests: [
              {
                name: "Create user",
                method: "post",
                endpoint: "https://example.com/users",
                headers: [
                  {
                    key: "content-type",
                    value: "application/json",
                    active: true,
                  },
                ],
                body: {
                  contentType: "application/json",
                  body: '{"name":"Ada"}',
                },
              },
            ],
          },
        ]),
      },
      {
        name: "hoppscotch-environments.json",
        content: JSON.stringify([
          {
            name: "Production",
            variables: [
              { key: "baseUrl", initialValue: "https://example.com" },
            ],
          },
        ]),
      },
    ]);

    expect(parsed.collections[0]?.requests[0]).toMatchObject({
      method: "POST",
      path: "https://example.com/users",
      body: '{"name":"Ada"}',
    });
    expect(parsed.environments[0]?.variables).toEqual([
      { name: "baseUrl", value: "https://example.com" },
    ]);
  });

  it.each([false, true])(
    "distinguishes Hoppscotch collections with variables from environments (array: %s)",
    (asArray) => {
      const collection = {
        v: 11,
        name: "Orders",
        variables: [],
        requests: [
          {
            name: "List orders",
            method: "GET",
            endpoint: "https://example.com/orders",
          },
        ],
        folders: [
          {
            name: "Admin",
            variables: [],
            folders: [],
            requests: [
              {
                name: "List users",
                method: "GET",
                endpoint: "https://example.com/users",
              },
            ],
          },
        ],
      };
      const environment = {
        v: 2,
        name: "Local",
        variables: [
          {
            key: "baseUrl",
            currentValue: "",
            initialValue: "https://example.com",
          },
        ],
      };
      const parsed = parseImportFiles([
        {
          name: "collection.json",
          content: JSON.stringify(asArray ? [collection] : collection),
        },
        {
          name: "environment.json",
          content: JSON.stringify(asArray ? [environment] : environment),
        },
      ]);

      expect(
        parsed.collections.map(({ name, requests }) => [name, requests.length]),
      ).toEqual([
        ["Orders", 1],
        ["Orders / Admin", 1],
      ]);
      expect(parsed.environments).toEqual([
        {
          name: "Local",
          variables: [{ name: "baseUrl", value: "https://example.com" }],
        },
      ]);
      expect(parsed.skippedRequests).toBe(0);
    },
  );

  it("converts Hoppscotch templates in URLs, bodies and header values", () => {
    const parsed = parseImportFiles([
      {
        name: "templates.json",
        content: JSON.stringify({
          name: "Templates",
          folders: [],
          requests: [
            {
              name: "Create order",
              method: "POST",
              endpoint: "<< baseUrl >>/orders/<<order.id>>?page={{page}}",
              body: {
                body: '{"customer":"<<customer-id>>","literal":"<<not a variable>>"}',
              },
              headers: [
                { key: "X-Account", value: "<<account>>", active: true },
                { key: "X-Disabled", value: "<<disabled>>", active: false },
              ],
            },
          ],
        }),
      },
    ]);
    expect(parsed.collections[0]?.requests).toEqual([
      {
        name: "Create order",
        method: "POST",
        path: "{{baseUrl}}/orders/{{order.id}}?page={{page}}",
        body: '{"customer":"{{customer-id}}","literal":"<<not a variable>>"}',
        headers: [{ name: "X-Account", value: "{{account}}" }],
      },
    ]);
    expect(parsed.skippedRequests).toBe(0);
  });

  it.each([
    [{ currentValue: "", initialValue: "initial" }, "initial"],
    [{ currentValue: "current", initialValue: "initial" }, "current"],
    [{ initialValue: "initial" }, "initial"],
    [{ currentValue: "" }, ""],
    [{ currentValue: "", initialValue: "" }, ""],
    [{ currentValue: "", initialValue: 0 }, "0"],
    [{ currentValue: 0, initialValue: 42 }, "0"],
    [{ currentValue: false, initialValue: true }, "false"],
    [{ currentValue: " ", initialValue: "initial" }, " "],
    [
      { value: "legacy", currentValue: "current", initialValue: "initial" },
      "legacy",
    ],
    [{ value: "", currentValue: "current", initialValue: "initial" }, ""],
  ])("preserves Hoppscotch environment values for %j", (values, expected) => {
    const parsed = parseImportFiles([
      {
        name: "environment.json",
        content: JSON.stringify({
          name: "Local",
          variables: [{ key: "setting", ...values }],
        }),
      },
    ]);
    expect(parsed.environments[0]?.variables).toEqual([
      { name: "setting", value: expected },
    ]);
  });

  it("does not import secret or disabled Hoppscotch initial values", () => {
    const parsed = parseImportFiles([
      {
        name: "environment.json",
        content: JSON.stringify({
          name: "Local",
          variables: [
            {
              key: "secret",
              secret: true,
              currentValue: "",
              initialValue: "do-not-import",
            },
            {
              key: "otherSecret",
              isSecret: true,
              initialValue: "do-not-import",
            },
            { key: "disabled", enabled: false, initialValue: "do-not-import" },
            { key: "empty", currentValue: "", initialValue: "" },
          ],
        }),
      },
    ]);
    expect(parsed.environments[0]?.variables).toEqual([
      { name: "empty", value: "" },
    ]);
    expect(parsed.skippedSecretVariables).toBe(2);
  });

  it("converts Postman bearer auth and URL-encoded bodies", () => {
    const parsed = parseImportFiles([
      {
        name: "auth.postman_collection.json",
        content: JSON.stringify({
          info: { name: "Authenticated" },
          auth: {
            type: "bearer",
            bearer: [{ key: "token", value: "{{token}}" }],
          },
          item: [
            {
              name: "Create token",
              request: {
                method: "POST",
                url: "https://example.com/token",
                body: {
                  mode: "urlencoded",
                  urlencoded: [{ key: "scope", value: "read write" }],
                },
              },
            },
          ],
        }),
      },
    ]);

    expect(parsed.collections[0]?.requests[0]).toMatchObject({
      body: "scope=read%20write",
      headers: [
        { name: "Authorization", value: "Bearer {{token}}" },
        {
          name: "content-type",
          value: "application/x-www-form-urlencoded",
        },
      ],
    });
    expect(parsed.omittedFields).toBe(0);
  });

  it("imports Yaak workspaces, folders, requests, and environments", () => {
    const parsed = parseImportFiles([
      {
        name: "yaak.json",
        content: JSON.stringify({
          yaakSchema: 5,
          resources: {
            workspaces: [{ id: "w1", name: "Payments" }],
            folders: [{ id: "f1", workspaceId: "w1", name: "Refunds" }],
            httpRequests: [
              {
                id: "r1",
                workspaceId: "w1",
                folderId: "f1",
                name: "Create refund",
                method: "POST",
                url: "{{baseUrl}}/refunds",
                headers: [
                  { name: "accept", value: "application/json", enabled: true },
                ],
                body: { text: "{}" },
              },
            ],
            environments: [
              {
                workspaceId: "w1",
                name: "Test",
                variables: [
                  { name: "baseUrl", value: "https://test.example.com" },
                ],
              },
            ],
          },
        }),
      },
    ]);

    expect(parsed.collections[0]).toMatchObject({ name: "Payments / Refunds" });
    expect(parsed.environments[0]).toEqual({
      name: "Test",
      variables: [{ name: "baseUrl", value: "https://test.example.com" }],
    });
  });

  it("converts Yaak variable references in URLs, bodies, and headers", () => {
    const parsed = parseImportFiles([
      {
        name: "yaak.json",
        content: JSON.stringify({
          yaakSchema: 4,
          resources: {
            workspaces: [{ id: "w1", name: "Example" }],
            httpRequests: [
              {
                workspaceId: "w1",
                name: "Templated request",
                method: "POST",
                url: "${[ base-url ]}/items/${[item.id]}?user=${[ _user ]}",
                body: {
                  text: '{"value":"${[ item.id ]}","existing":"{{existing}}","literal":"${literal}","expression":"${[ uuid() ]}"}',
                },
                headers: [
                  { name: "X-Tenant", value: "${[ tenant ]}:${[item.id]}" },
                  { name: "X-Disabled", value: "${[ignored]}", enabled: false },
                ],
                authenticationType: "bearer",
                authentication: { token: "discarded", disabled: false },
              },
              {
                workspaceId: "w1",
                name: "Absolute URL",
                method: "GET",
                url: "https://example.com/${[ item.id ]}",
              },
            ],
            environments: [
              {
                name: "Base",
                base: true,
                variables: [{ name: "base-url", value: "https://example.com" }],
              },
              {
                name: "Test",
                base: false,
                variables: [{ name: "tenant", value: "test" }],
              },
            ],
          },
        }),
      },
    ]);

    expect(parsed.skippedRequests).toBe(0);
    expect(parsed.collections[0].requests).toEqual([
      {
        name: "Templated request",
        method: "POST",
        path: "{{base-url}}/items/{{item.id}}?user={{_user}}",
        body: '{"value":"{{item.id}}","existing":"{{existing}}","literal":"${literal}","expression":"${[ uuid() ]}"}',
        headers: [{ name: "X-Tenant", value: "{{tenant}}:{{item.id}}" }],
      },
      {
        name: "Absolute URL",
        method: "GET",
        path: "https://example.com/{{item.id}}",
        body: "",
        headers: [],
      },
    ]);
    expect(parsed.environments).toEqual([
      {
        name: "Base",
        variables: [{ name: "base-url", value: "https://example.com" }],
      },
      { name: "Test", variables: [{ name: "tenant", value: "test" }] },
    ]);
  });

  it("rejects unknown and malformed exports", () => {
    expect(() =>
      parseImportFiles([{ name: "bad.json", content: "{" }]),
    ).toThrow("not valid JSON");
    expect(() =>
      parseImportFiles([
        { name: "unknown.json", content: JSON.stringify({ hello: "world" }) },
      ]),
    ).toThrow("not a supported");
  });
});
