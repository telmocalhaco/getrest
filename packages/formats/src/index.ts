import { variableNameError } from "./variableNames";

export { variableNameError } from "./variableNames";

export interface ImportSourceFile {
  name: string;
  content: string;
}

export interface ImportedHeader {
  name: string;
  value: string;
}

export interface ImportedRequest {
  name: string;
  method: string;
  path: string;
  body: string;
  headers: ImportedHeader[];
}

export interface ImportedCollection {
  name: string;
  requests: ImportedRequest[];
}

export interface ImportedEnvironmentVariable {
  name: string;
  value: string;
}

export interface ImportedEnvironment {
  name: string;
  variables: ImportedEnvironmentVariable[];
}

export interface ParsedImport {
  collections: ImportedCollection[];
  environments: ImportedEnvironment[];
  skippedRequests: number;
  skippedVariables: number;
  skippedSecretVariables: number;
  omittedFields: number;
}

const supportedMethods = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

type JsonObject = Record<string, unknown>;

export function parseImportFiles(files: ImportSourceFile[]): ParsedImport {
  const result: ParsedImport = {
    collections: [],
    environments: [],
    skippedRequests: 0,
    skippedVariables: 0,
    skippedSecretVariables: 0,
    omittedFields: 0,
  };

  for (const file of files) {
    let value: unknown;
    try {
      value = JSON.parse(file.content);
    } catch {
      throw new Error(`${file.name} is not valid JSON.`);
    }

    const object = asObject(value);
    if (object && "yaakSchema" in object) {
      parseYaak(object, result);
    } else if (isPostmanCollection(value)) {
      parsePostmanCollection(value, result);
    } else if (isPostmanEnvironment(value)) {
      parsePostmanEnvironment(value, result);
    } else if (looksLikeHoppscotchCollections(value)) {
      parseHoppscotchCollections(value, result);
    } else if (looksLikeHoppscotchEnvironments(value)) {
      parseHoppscotchEnvironments(value, result);
    } else {
      throw new Error(
        `${file.name} is not a supported Postman, Hoppscotch, or Yaak export.`,
      );
    }
  }

  if (result.collections.length === 0 && result.environments.length === 0) {
    throw new Error("The selected exports do not contain importable data.");
  }
  return result;
}

function parsePostmanCollection(value: JsonObject, result: ParsedImport) {
  const info = asObject(value.info);
  const rootName = stringValue(info?.name) ?? "Postman collection";
  parsePostmanItems(asArray(value.item), rootName, result, value.auth);
}

function parsePostmanItems(
  items: unknown[],
  collectionName: string,
  result: ParsedImport,
  inheritedAuth?: unknown,
) {
  const requests: ImportedRequest[] = [];
  for (const itemValue of items) {
    const item = asObject(itemValue);
    if (!item) continue;
    if (Array.isArray(item.item)) {
      parsePostmanItems(
        item.item,
        `${collectionName} / ${stringValue(item.name) ?? "Folder"}`,
        result,
        item.auth ?? inheritedAuth,
      );
      continue;
    }
    const request = asObject(item.request);
    if (!request) continue;
    const headers = parseHeaders(request.header, "key", "disabled");
    headers.push(
      ...postmanAuthHeaders(request.auth ?? inheritedAuth, result, headers),
    );
    const imported = createRequest({
      name: stringValue(item.name) ?? "Imported request",
      method: stringValue(request.method),
      path: postmanUrl(request.url),
      body: postmanBody(request.body, result, headers),
      headers,
    });
    if (imported) requests.push(imported);
    else result.skippedRequests += 1;
  }
  if (requests.length > 0)
    result.collections.push({ name: collectionName, requests });
}

function parsePostmanEnvironment(value: JsonObject, result: ParsedImport) {
  const variables = parseVariables(asArray(value.values), result, {
    nameKeys: ["key", "name"],
    valueKeys: ["value"],
    secret: (entry) => stringValue(entry.type)?.toLowerCase() === "secret",
    enabled: (entry) => entry.enabled !== false,
  });
  result.environments.push({
    name: stringValue(value.name) ?? "Postman environment",
    variables,
  });
}

function parseHoppscotchCollections(value: unknown, result: ParsedImport) {
  for (const collectionValue of asArrayOrSingle(value)) {
    const collection = asObject(collectionValue);
    if (!collection) continue;
    const name = stringValue(collection.name) ?? "Hoppscotch collection";
    parseHoppscotchCollection(collection, name, result);
  }
}

function parseHoppscotchCollection(
  collection: JsonObject,
  name: string,
  result: ParsedImport,
) {
  const requests: ImportedRequest[] = [];
  for (const requestValue of asArray(collection.requests)) {
    const request = asObject(requestValue);
    if (!request) continue;
    const imported = createRequest({
      name: stringValue(request.name) ?? "Imported request",
      method: stringValue(request.method),
      path: normalizeHoppscotchTemplates(
        stringValue(request.endpoint) ?? stringValue(request.url) ?? "",
      ),
      body: normalizeHoppscotchTemplates(hoppscotchBody(request.body)),
      headers: parseHeaders(request.headers, "key", "inactive").map(
        (header) => ({
          ...header,
          value: normalizeHoppscotchTemplates(header.value),
        }),
      ),
    });
    if (hasConfiguredAuth(request.auth)) result.omittedFields += 1;
    if (imported) requests.push(imported);
    else result.skippedRequests += 1;
  }
  if (requests.length > 0) result.collections.push({ name, requests });
  for (const folderValue of asArray(collection.folders)) {
    const folder = asObject(folderValue);
    if (!folder) continue;
    parseHoppscotchCollection(
      folder,
      `${name} / ${stringValue(folder.name) ?? "Folder"}`,
      result,
    );
  }
}

function parseHoppscotchEnvironments(value: unknown, result: ParsedImport) {
  for (const environmentValue of asArrayOrSingle(value)) {
    const environment = asObject(environmentValue);
    if (!environment) continue;
    const variables = parseVariables(asArray(environment.variables), result, {
      nameKeys: ["key", "name"],
      valueKeys: ["value", "currentValue", "initialValue"],
      readValue: hoppscotchVariableValue,
      secret: (entry) => entry.secret === true || entry.isSecret === true,
      enabled: (entry) => entry.enabled !== false,
    });
    result.environments.push({
      name: stringValue(environment.name) ?? "Hoppscotch environment",
      variables,
    });
  }
}

function parseYaak(value: JsonObject, result: ParsedImport) {
  const resources = asObject(value.resources);
  if (!resources) throw new Error("The Yaak export has no resources.");
  const workspaces = asArray(resources.workspaces)
    .map(asObject)
    .filter((item): item is JsonObject => item !== undefined);
  const folders = asArray(resources.folders)
    .map(asObject)
    .filter((item): item is JsonObject => item !== undefined);
  const requests = asArray(resources.httpRequests ?? resources.requests)
    .map(asObject)
    .filter((item): item is JsonObject => item !== undefined);

  for (const workspace of workspaces) {
    const workspaceId = stringValue(workspace.id);
    const workspaceName = stringValue(workspace.name) ?? "Yaak workspace";
    const workspaceFolders = folders.filter(
      (folder) => stringValue(folder.workspaceId) === workspaceId,
    );
    const groups = new Map<string | undefined, ImportedRequest[]>();
    for (const request of requests.filter(
      (entry) => stringValue(entry.workspaceId) === workspaceId,
    )) {
      const imported = createRequest({
        name: stringValue(request.name) ?? "Imported request",
        method: stringValue(request.method),
        path: normalizeYaakTemplates(stringValue(request.url) ?? ""),
        body: normalizeYaakTemplates(yaakBody(request.body)),
        headers: parseHeaders(request.headers, "name", "disabled").map(
          (header) => ({
            ...header,
            value: normalizeYaakTemplates(header.value),
          }),
        ),
      });
      if (
        hasConfiguredAuth(request.authentication ?? request.authenticationType)
      )
        result.omittedFields += 1;
      if (!imported) {
        result.skippedRequests += 1;
        continue;
      }
      const folderId = stringValue(request.folderId);
      groups.set(folderId, [...(groups.get(folderId) ?? []), imported]);
    }
    for (const [folderId, groupedRequests] of groups) {
      const folderPath = yaakFolderPath(folderId, workspaceFolders);
      result.collections.push({
        name: folderPath ? `${workspaceName} / ${folderPath}` : workspaceName,
        requests: groupedRequests,
      });
    }
  }

  for (const environmentValue of asArray(resources.environments)) {
    const environment = asObject(environmentValue);
    if (!environment) continue;
    const variables = parseVariables(asArray(environment.variables), result, {
      nameKeys: ["name", "key"],
      valueKeys: ["value"],
      secret: (entry) => entry.secret === true || entry.isSecret === true,
      enabled: (entry) => entry.enabled !== false,
    });
    result.environments.push({
      name: stringValue(environment.name) ?? "Yaak environment",
      variables,
    });
  }
}

function createRequest(input: {
  name: string;
  method?: string;
  path?: string;
  body: string;
  headers: ImportedHeader[];
}): ImportedRequest | undefined {
  const method = input.method?.toUpperCase();
  const path = input.path?.trim();
  if (
    !method ||
    !supportedMethods.has(method) ||
    !path ||
    !/^(https?:\/\/|{{)/.test(path)
  )
    return undefined;
  return {
    ...input,
    method,
    path,
    name: input.name.trim() || "Imported request",
  } as ImportedRequest;
}

function parseHeaders(
  value: unknown,
  nameKey: string,
  disabledKey: string,
): ImportedHeader[] {
  const headers: ImportedHeader[] = [];
  for (const headerValue of asArray(value)) {
    const header = asObject(headerValue);
    if (
      !header ||
      header[disabledKey] === true ||
      header.active === false ||
      header.enabled === false
    )
      continue;
    const name = stringValue(header[nameKey])?.trim();
    const content = scalarString(header.value);
    if (name && content !== undefined) headers.push({ name, value: content });
  }
  return headers;
}

function parseVariables(
  values: unknown[],
  result: ParsedImport,
  options: {
    nameKeys: string[];
    valueKeys: string[];
    readValue?: (entry: JsonObject) => string | undefined;
    secret: (entry: JsonObject) => boolean;
    enabled: (entry: JsonObject) => boolean;
  },
): ImportedEnvironmentVariable[] {
  const variables = new Map<string, ImportedEnvironmentVariable>();
  for (const value of values) {
    const entry = asObject(value);
    if (!entry || !options.enabled(entry)) continue;
    if (options.secret(entry)) {
      result.skippedSecretVariables += 1;
      continue;
    }
    const name = firstString(entry, options.nameKeys)?.trim();
    const content = options.readValue
      ? options.readValue(entry)
      : firstScalar(entry, options.valueKeys);
    if (
      name &&
      variableNameError(name) === null &&
      content !== undefined &&
      !variables.has(name.toLowerCase())
    ) {
      variables.set(name.toLowerCase(), { name, value: content });
    } else if (name) {
      result.skippedVariables += 1;
    }
  }
  return [...variables.values()];
}

function postmanUrl(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const url = asObject(value);
  if (!url) return undefined;
  const raw = stringValue(url.raw);
  if (raw) return raw;
  const protocol = stringValue(url.protocol);
  const host = urlSegments(url.host).join(".");
  const path = urlSegments(url.path).join("/");
  const query = asArray(url.query)
    .map(asObject)
    .filter(
      (entry): entry is JsonObject =>
        entry !== undefined && entry.disabled !== true,
    )
    .map((entry) => {
      const key = stringValue(entry.key) ?? "";
      const content = scalarString(entry.value) ?? "";
      return `${encodeURIComponent(key)}=${encodeURIComponent(content)}`;
    })
    .filter((entry) => !entry.startsWith("="))
    .join("&");
  return protocol && host
    ? `${protocol}://${host}/${path}${query ? `?${query}` : ""}`
    : undefined;
}

function urlSegments(value: unknown): string[] {
  if (typeof value === "string") return value.split("/").filter(Boolean);
  return asArray(value)
    .map(stringValue)
    .filter((part): part is string => Boolean(part));
}

function postmanBody(
  value: unknown,
  result: ParsedImport,
  headers: ImportedHeader[],
): string {
  const body = asObject(value);
  if (!body) return "";
  const mode = stringValue(body.mode);
  if (!mode || mode === "raw") return stringValue(body.raw) ?? "";
  if (mode === "urlencoded") {
    if (
      !headers.some((header) => header.name.toLowerCase() === "content-type")
    ) {
      headers.push({
        name: "content-type",
        value: "application/x-www-form-urlencoded",
      });
    }
    return asArray(body.urlencoded)
      .map(asObject)
      .filter(
        (entry): entry is JsonObject =>
          entry !== undefined && entry.disabled !== true,
      )
      .map((entry) => {
        const key = stringValue(entry.key) ?? "";
        const content = scalarString(entry.value) ?? "";
        return `${encodeURIComponent(key)}=${encodeURIComponent(content)}`;
      })
      .join("&");
  }
  result.omittedFields += 1;
  return "";
}

function postmanAuthHeaders(
  value: unknown,
  result: ParsedImport,
  headers: ImportedHeader[],
): ImportedHeader[] {
  if (headers.some((header) => header.name.toLowerCase() === "authorization"))
    return [];
  const auth = asObject(value);
  const type = stringValue(auth?.type)?.toLowerCase();
  if (!auth || !type || type === "noauth") return [];
  const settings = asArray(auth[type])
    .map(asObject)
    .filter((entry): entry is JsonObject => entry !== undefined);
  if (type === "bearer") {
    const token = settings.find((entry) => entry.key === "token");
    const content = scalarString(token?.value);
    if (content !== undefined)
      return [{ name: "Authorization", value: `Bearer ${content}` }];
  }
  if (type === "apikey") {
    const key = scalarString(
      settings.find((entry) => entry.key === "key")?.value,
    );
    const content = scalarString(
      settings.find((entry) => entry.key === "value")?.value,
    );
    const location = scalarString(
      settings.find((entry) => entry.key === "in")?.value,
    );
    if (key && content !== undefined && location === "header")
      return [{ name: key, value: content }];
  }
  result.omittedFields += 1;
  return [];
}

function normalizeHoppscotchTemplates(value: string): string {
  return value.replace(/<<\s*([A-Za-z_][A-Za-z0-9_.-]{0,99})\s*>>/g, "{{$1}}");
}

function hoppscotchVariableValue(entry: JsonObject): string | undefined {
  const legacyValue = scalarString(entry.value);
  if (legacyValue !== undefined) return legacyValue;
  const currentValue = scalarString(entry.currentValue);
  if (currentValue !== undefined && currentValue !== "") return currentValue;
  // Some exports leave currentValue empty while preserving the initial value.
  return scalarString(entry.initialValue) ?? currentValue;
}

function hoppscotchBody(value: unknown): string {
  if (typeof value === "string") return value;
  const body = asObject(value);
  return stringValue(body?.body) ?? stringValue(body?.content) ?? "";
}

function normalizeYaakTemplates(value: string): string {
  return value.replace(
    /\$\{\[\s*([A-Za-z_][A-Za-z0-9_.-]{0,99})\s*\]\}/g,
    "{{$1}}",
  );
}

function yaakBody(value: unknown): string {
  if (typeof value === "string") return value;
  const body = asObject(value);
  return stringValue(body?.text) ?? "";
}

function hasConfiguredAuth(value: unknown): boolean {
  if (typeof value === "string")
    return !["", "none", "inherit"].includes(value.toLowerCase());
  const auth = asObject(value);
  if (!auth) return false;
  const type = firstString(auth, ["authType", "type"]);
  return Boolean(
    type && !["none", "inherit", "noauth"].includes(type.toLowerCase()),
  );
}

function yaakFolderPath(
  folderId: string | undefined,
  folders: JsonObject[],
): string {
  const parts: string[] = [];
  const visited = new Set<string>();
  let currentId = folderId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = folders.find((entry) => stringValue(entry.id) === currentId);
    if (!folder) break;
    parts.unshift(stringValue(folder.name) ?? "Folder");
    currentId = stringValue(folder.folderId);
  }
  return parts.join(" / ");
}

function isPostmanCollection(value: unknown): value is JsonObject {
  const object = asObject(value);
  const info = asObject(object?.info);
  return Boolean(object && info && Array.isArray(object.item));
}

function isPostmanEnvironment(value: unknown): value is JsonObject {
  const object = asObject(value);
  return Boolean(
    object && Array.isArray(object.values) && !Array.isArray(object.item),
  );
}

function looksLikeHoppscotchCollections(value: unknown): boolean {
  return asArrayOrSingle(value).some((entry) => {
    const object = asObject(entry);
    return Boolean(
      object &&
      (Array.isArray(object.requests) || Array.isArray(object.folders)),
    );
  });
}

function looksLikeHoppscotchEnvironments(value: unknown): boolean {
  const entries = asArrayOrSingle(value);
  return (
    entries.length > 0 &&
    entries.every((entry) => Array.isArray(asObject(entry)?.variables))
  );
}

function asObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asArrayOrSingle(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function scalarString(value: unknown): string | undefined {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : undefined;
}

function firstString(object: JsonObject, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = stringValue(object[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function firstScalar(object: JsonObject, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = scalarString(object[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}
