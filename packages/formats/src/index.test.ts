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
