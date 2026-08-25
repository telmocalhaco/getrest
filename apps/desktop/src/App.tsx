import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { CollectionRunnerDialog } from "./CollectionRunnerDialog";
import type {
  HttpMethod,
  RestHeader,
  RestRequestSnapshot,
  RestResponse,
} from "./domain/rest";
import type {
  EnvironmentVariable,
  WorkspaceEnvironment,
} from "./domain/environment";
import type {
  WorkspaceCollection,
  WorkspaceGitState,
  WorkspaceSummary,
} from "./domain/workspace";
import { sendRestRequest } from "./services/restRequests";
import {
  deleteWorkspaceEnvironment,
  loadWorkspaceEnvironments,
  saveWorkspaceEnvironment,
} from "./services/environments";
import {
  activateWorkspace,
  createWorkspace,
  createWorkspaceCollection,
  deleteWorkspaceCollection,
  deleteWorkspaceRequest,
  getActiveWorkspace,
  listWorkspaces,
  loadWorkspaceCollections,
  renameWorkspace,
  renameWorkspaceCollection,
  saveWorkspaceRequest,
  selectWorkspaceDirectory,
  exportWorkspaceKey,
  importWorkspaceKey,
  WorkspaceServiceError,
} from "./services/workspaces";

type IconName =
  | "archive"
  | "bolt"
  | "chevron-down"
  | "chevron-right"
  | "clock"
  | "code"
  | "copy"
  | "folder"
  | "gear"
  | "history"
  | "layout"
  | "more"
  | "plus"
  | "search"
  | "save"
  | "send"
  | "sidebar"
  | "trash";
interface RequestExample {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  collection: string;
  body: string;
  headers: RestHeader[];
}

type DeleteTarget =
  | { type: "request"; id: string; name: string }
  | { type: "collection"; name: string; requestCount: number };

const initialRequests: RequestExample[] = [
  {
    id: "todo",
    name: "Todo details",
    method: "GET",
    path: "https://jsonplaceholder.typicode.com/todos/1",
    collection: "Public API",
    body: "",
    headers: [],
  },
  {
    id: "posts",
    name: "Recent posts",
    method: "GET",
    path: "https://jsonplaceholder.typicode.com/posts?_limit=5",
    collection: "Public API",
    body: "",
    headers: [],
  },
  {
    id: "create-post",
    name: "Create post",
    method: "POST",
    path: "https://jsonplaceholder.typicode.com/posts",
    collection: "Public API",
    body: '{\n  "title": "GetRest request",\n  "body": "Sent by the native Rust engine",\n  "userId": 1\n}',
    headers: [],
  },
];

const emptyRequest: RequestExample = {
  id: "",
  name: "New request",
  method: "GET",
  path: "",
  collection: "",
  body: "",
  headers: [],
};

const methods: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];
const requestTabs = ["Body", "Params", "Headers", "Auth"] as const;
const responseTabs = ["Response", "Request", "Headers"] as const;

function HighlightedTemplate({
  value,
  variableNames,
}: {
  value: string;
  variableNames: ReadonlySet<string>;
}) {
  const placeholderPattern = /{{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*}}/g;
  const parts: React.ReactNode[] = [];
  let previousIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = placeholderPattern.exec(value)) !== null) {
    if (match.index > previousIndex) {
      parts.push(value.slice(previousIndex, match.index));
    }
    const name = match[1];
    const isDefined = variableNames.has(name);
    parts.push(
      <span
        className={`template-variable ${isDefined ? "defined" : "missing"}`}
        data-variable-name={name}
        key={`${match.index}-${name}`}
        title={
          isDefined
            ? `${name} is defined in the active environment`
            : `${name} is missing from the active environment`
        }
      >
        {match[0]}
      </span>,
    );
    previousIndex = match.index + match[0].length;
  }
  parts.push(value.slice(previousIndex));
  return <>{parts}</>;
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    archive: (
      <>
        <path d="M4 7h16M5 7l1 13h12l1-13M9 11h6M3 4h18v3H3z" />
      </>
    ),
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7z" />,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    code: (
      <>
        <path d="m8 9-3 3 3 3m8-6 3 3-3 3m-2-10-4 14" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    folder: (
      <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 15a2 2 0 0 0 .4 2l-2.4 2.4a2 2 0 0 0-2-.4 2 2 0 0 0-1 2h-4a2 2 0 0 0-1-2 2 2 0 0 0-2 .4L4.6 17A2 2 0 0 0 5 15a2 2 0 0 0-2-1v-4a2 2 0 0 0 2-1 2 2 0 0 0-.4-2L7 4.6A2 2 0 0 0 9 5a2 2 0 0 0 1-2h4a2 2 0 0 0 1 2 2 2 0 0 0 2-.4L19.4 7A2 2 0 0 0 19 9a2 2 0 0 0 2 1v4a2 2 0 0 0-2 1Z" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    layout: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </>
    ),
    more: (
      <>
        <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    save: (
      <>
        <path d="M5 4h12l2 2v14H5z" />
        <path d="M8 4v6h8V4M8 20v-6h8v6" />
      </>
    ),
    send: <path d="m4 4 17 8-17 8 3-8zm3 8h14" />,
    sidebar: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 4v16" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      >
        {paths[name]}
      </g>
    </svg>
  );
}

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className={`method method-${method.toLowerCase()}`}>{method}</span>
  );
}

function formatResponseBody(response: RestResponse): string {
  if (!response.body) return "";

  if (response.contentType?.toLowerCase().includes("json")) {
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      return response.body;
    }
  }

  return response.body;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function workspaceStatusLabel(state?: WorkspaceGitState): string {
  const labels: Record<WorkspaceGitState, string> = {
    localOnly: "Local only",
    clean: "Up to date",
    changes: "Changes not committed",
    unavailable: "Workspace unavailable",
  };
  return state ? labels[state] : "No workspace";
}

function isHttpMethod(value: string): value is HttpMethod {
  return methods.some((method) => method === value);
}

function collectionsFromRequests(
  requests: RequestExample[],
  collectionNames: string[] = [],
): WorkspaceCollection[] {
  const grouped = new Map<string, RequestExample[]>(
    collectionNames.map((name) => [name, []]),
  );
  for (const request of requests) {
    const existing = grouped.get(request.collection) ?? [];
    existing.push(request);
    grouped.set(request.collection, existing);
  }
  return [...grouped.entries()].map(([name, collectionRequests]) => ({
    name,
    requests: collectionRequests.map(
      ({ id, name: requestName, method, path, body, headers }) => ({
        id,
        name: requestName,
        method,
        path,
        body,
        headers,
      }),
    ),
  }));
}

function requestsFromCollections(
  collections: WorkspaceCollection[],
): RequestExample[] {
  return collections.flatMap((collection) =>
    collection.requests
      .filter((request) => isHttpMethod(request.method))
      .map((request) => ({
        ...request,
        method: request.method as HttpMethod,
        collection: collection.name,
        headers: request.headers ?? [],
      })),
  );
}

function App() {
  const [selectedId, setSelectedId] = useState("todo");
  const [requests, setRequests] = useState<RequestExample[]>(initialRequests);
  const [collectionNames, setCollectionNames] = useState<string[]>([
    "Public API",
  ]);
  const [requestTab, setRequestTab] =
    useState<(typeof requestTabs)[number]>("Body");
  const [responseTab, setResponseTab] =
    useState<(typeof responseTabs)[number]>("Response");
  const [search, setSearch] = useState("");
  const [collapsedCollections, setCollapsedCollections] = useState<string[]>(
    [],
  );
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<RestResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<RestRequestSnapshot | null>(
    null,
  );
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [knownWorkspaces, setKnownWorkspaces] = useState<WorkspaceSummary[]>(
    [],
  );
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [workspaceDialogMode, setWorkspaceDialogMode] = useState<
    "manage" | "create"
  >("create");
  const [workspaceDirectory, setWorkspaceDirectory] = useState("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceContent, setWorkspaceContent] = useState<"move" | "empty">(
    "move",
  );
  const [gitIdentityRequired, setGitIdentityRequired] = useState(false);
  const [gitAuthorName, setGitAuthorName] = useState("");
  const [gitAuthorEmail, setGitAuthorEmail] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isRenamingWorkspace, setIsRenamingWorkspace] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [isTransferringWorkspaceKey, setIsTransferringWorkspaceKey] =
    useState(false);
  const [workspaceKeyStatus, setWorkspaceKeyStatus] = useState<string | null>(
    null,
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogPurpose, setSaveDialogPurpose] = useState<"save" | "rename">(
    "save",
  );
  const [saveRequestName, setSaveRequestName] = useState("");
  const [saveCollectionName, setSaveCollectionName] = useState("");
  const [saveRequestError, setSaveRequestError] = useState<string | null>(null);
  const [isSavingRequest, setIsSavingRequest] = useState(false);
  const [renameCollectionDialogOpen, setRenameCollectionDialogOpen] =
    useState(false);
  const [renameCollectionCurrent, setRenameCollectionCurrent] = useState("");
  const [renameCollectionName, setRenameCollectionName] = useState("");
  const [renameCollectionError, setRenameCollectionError] = useState<
    string | null
  >(null);
  const [isRenamingCollection, setIsRenamingCollection] = useState(false);
  const [requestMenuOpen, setRequestMenuOpen] = useState(false);
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [runnerDialogOpen, setRunnerDialogOpen] = useState(false);
  const [runnerCollection, setRunnerCollection] = useState("");
  const [collectionDialogPurpose, setCollectionDialogPurpose] = useState<
    "create" | "rename"
  >("rename");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [environments, setEnvironments] = useState<WorkspaceEnvironment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState("");
  const [environmentDialogOpen, setEnvironmentDialogOpen] = useState(false);
  const [environmentDraftId, setEnvironmentDraftId] = useState<string | null>(
    null,
  );
  const [environmentName, setEnvironmentName] = useState("");
  const [environmentVariables, setEnvironmentVariables] = useState<
    EnvironmentVariable[]
  >([]);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [isSavingEnvironment, setIsSavingEnvironment] = useState(false);
  const [isDeletingEnvironment, setIsDeletingEnvironment] = useState(false);
  const [environmentDeletePending, setEnvironmentDeletePending] =
    useState(false);
  const selected = selectedId
    ? (requests.find((request) => request.id === selectedId) ??
      requests[0] ??
      emptyRequest)
    : emptyRequest;
  const [methodDraft, setMethodDraft] = useState<HttpMethod>(selected.method);
  const [urlDraft, setUrlDraft] = useState(selected.path);
  const [bodyDraft, setBodyDraft] = useState(selected.body);
  const [headerDrafts, setHeaderDrafts] = useState<RestHeader[]>(
    selected.headers,
  );
  const urlHighlightRef = useRef<HTMLDivElement>(null);
  const bodyHighlightRef = useRef<HTMLPreElement>(null);
  const activeEnvironment = environments.find(
    (environment) => environment.id === activeEnvironmentId,
  );
  const activeVariableNames = useMemo(
    () =>
      new Set(
        activeEnvironment?.variables.map((variable) => variable.name) ?? [],
      ),
    [activeEnvironment],
  );

  useEffect(() => {
    let active = true;
    getActiveWorkspace()
      .then(async (storedWorkspace) => {
        if (!active) return;
        setWorkspace(storedWorkspace);
        setWorkspaceName(storedWorkspace?.name ?? "");
        if (storedWorkspace) {
          try {
            const [storedCollections, storedEnvironments] = await Promise.all([
              loadWorkspaceCollections(storedWorkspace.id),
              loadWorkspaceEnvironments(storedWorkspace.id),
            ]);
            if (active) {
              applyCollections(storedCollections);
              applyEnvironments(storedEnvironments);
            }
          } catch (error) {
            if (active) {
              setCollectionNames([]);
              applyRequests([]);
              applyEnvironments([]);
              setWorkspaceError(
                error instanceof Error
                  ? error.message
                  : "The workspace collections could not be loaded.",
              );
            }
          }
        }
      })
      .catch(() => {
        if (active) setWorkspace(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? requests.filter((request) =>
          `${request.name} ${request.path} ${request.method}`
            .toLowerCase()
            .includes(query),
        )
      : requests;
  }, [requests, search]);

  const selectRequest = (request: RequestExample) => {
    setRequestMenuOpen(false);
    setSelectedId(request.id);
    setMethodDraft(request.method);
    setUrlDraft(request.path);
    setBodyDraft(request.body);
    setHeaderDrafts(request.headers);
    setResponseTab("Response");
    setResponse(null);
    setRequestError(null);
    setLastRequest(null);
  };

  const toggleCollection = (collection: string) =>
    setCollapsedCollections((current) =>
      current.includes(collection)
        ? current.filter((name) => name !== collection)
        : [...current, collection],
    );

  const sendRequest = async () => {
    if (isSending || !urlDraft.trim()) return;
    setIsSending(true);
    setResponse(null);
    setRequestError(null);
    const requestHeaders = headerDrafts
      .filter((header) => header.name.trim())
      .map((header) => ({
        name: header.name.trim(),
        value: header.value.trim(),
      }));
    if (
      bodyDraft.trim() &&
      !["GET", "HEAD"].includes(methodDraft) &&
      !requestHeaders.some(
        (header) => header.name.toLowerCase() === "content-type",
      )
    ) {
      requestHeaders.push({
        name: "content-type",
        value: "application/json",
      });
    }
    setLastRequest({
      method: methodDraft,
      url: urlDraft.trim(),
      headers: requestHeaders,
      body:
        bodyDraft.trim() && !["GET", "HEAD"].includes(methodDraft)
          ? bodyDraft.trim()
          : null,
      variables: activeEnvironment?.variables ?? [],
      sentAt: new Date().toISOString(),
    });

    try {
      const result = await sendRestRequest({
        method: methodDraft,
        url: urlDraft,
        headers: headerDrafts,
        body: bodyDraft,
        variables: activeEnvironment?.variables ?? [],
      });
      setResponse(result);
      setResponseTab("Response");
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "The request could not be completed.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const copyResponse = async () => {
    if (response) await navigator.clipboard?.writeText(response.body);
  };

  const applyRequests = (
    nextRequests: RequestExample[],
    preferredId?: string,
  ) => {
    setRequests(nextRequests);
    const first =
      nextRequests.find((request) => request.id === preferredId) ??
      nextRequests[0] ??
      emptyRequest;
    setSelectedId(first.id);
    setMethodDraft(first.method);
    setUrlDraft(first.path);
    setBodyDraft(first.body);
    setHeaderDrafts(first.headers);
    setResponse(null);
    setRequestError(null);
    setLastRequest(null);
  };

  const applyCollections = (
    collections: WorkspaceCollection[],
    preferredId?: string,
  ) => {
    setCollectionNames(collections.map((collection) => collection.name));
    applyRequests(requestsFromCollections(collections), preferredId);
  };

  const applyEnvironments = (
    nextEnvironments: WorkspaceEnvironment[],
    preferredId?: string,
  ) => {
    setEnvironments(nextEnvironments);
    setActiveEnvironmentId((current) => {
      if (preferredId && nextEnvironments.some(({ id }) => id === preferredId))
        return preferredId;
      if (nextEnvironments.some(({ id }) => id === current)) return current;
      return nextEnvironments[0]?.id ?? "";
    });
  };

  const openWorkspaceDialog = async () => {
    setWorkspaceDialogOpen(true);
    setWorkspaceDialogMode(workspace ? "manage" : "create");
    setWorkspaceDirectory("");
    if (!workspace) setWorkspaceError(null);
    setWorkspaceKeyStatus(null);
    setWorkspaceName(workspace?.name ?? "");
    setWorkspaceContent(requests.length > 0 ? "move" : "empty");
    setGitIdentityRequired(false);
    setGitAuthorName("");
    setGitAuthorEmail("");
    try {
      setKnownWorkspaces(await listWorkspaces());
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "The saved workspaces could not be loaded.",
      );
    }
  };

  const beginNewWorkspace = () => {
    setWorkspaceDialogMode("create");
    setWorkspaceDirectory("");
    setWorkspaceError(null);
    setWorkspaceContent(requests.length > 0 ? "move" : "empty");
    setGitIdentityRequired(false);
  };

  const chooseWorkspaceFolder = async () => {
    setWorkspaceError(null);
    try {
      const directory = await selectWorkspaceDirectory();
      if (directory) {
        setWorkspaceDirectory(directory);
        setGitIdentityRequired(false);
      }
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "The folder could not be selected.",
      );
    }
  };

  const submitWorkspace = async () => {
    if (!workspaceDirectory || isCreatingWorkspace) return;
    setIsCreatingWorkspace(true);
    setWorkspaceError(null);

    try {
      const createdWorkspace = await createWorkspace(
        workspaceDirectory,
        gitIdentityRequired
          ? { name: gitAuthorName, email: gitAuthorEmail }
          : null,
        workspaceContent === "move"
          ? collectionsFromRequests(
              requests.map((request) =>
                request.id === selectedId
                  ? {
                      ...request,
                      method: methodDraft,
                      path: urlDraft,
                      body: bodyDraft,
                      headers: headerDrafts,
                    }
                  : request,
              ),
              collectionNames,
            )
          : [],
      );
      setWorkspace(createdWorkspace);
      setWorkspaceName(createdWorkspace.name);
      if (workspaceContent === "empty") {
        setCollectionNames([]);
        applyRequests([]);
      }
      applyEnvironments([]);
      setWorkspaceDialogOpen(false);
    } catch (error) {
      if (
        error instanceof WorkspaceServiceError &&
        error.code === "git_identity_required"
      ) {
        setGitIdentityRequired(true);
      }
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "The workspace could not be created.",
      );
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const submitWorkspaceRename = async () => {
    if (!workspace || isRenamingWorkspace) return;
    setIsRenamingWorkspace(true);
    setWorkspaceError(null);
    try {
      const renamed = await renameWorkspace(workspace.id, workspaceName);
      setWorkspace(renamed);
      setKnownWorkspaces((current) =>
        current.map((item) => (item.id === renamed.id ? renamed : item)),
      );
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "The workspace could not be renamed.",
      );
    } finally {
      setIsRenamingWorkspace(false);
    }
  };

  const exportActiveWorkspaceKey = async () => {
    if (!workspace || isTransferringWorkspaceKey) return;
    setIsTransferringWorkspaceKey(true);
    setWorkspaceError(null);
    setWorkspaceKeyStatus(null);
    try {
      const path = await exportWorkspaceKey(workspace.id);
      if (path) setWorkspaceKeyStatus(`Encryption key exported to ${path}`);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "The workspace encryption key could not be exported.",
      );
    } finally {
      setIsTransferringWorkspaceKey(false);
    }
  };

  const importActiveWorkspaceKey = async () => {
    if (!workspace || isTransferringWorkspaceKey) return;
    setIsTransferringWorkspaceKey(true);
    setWorkspaceError(null);
    setWorkspaceKeyStatus(null);
    try {
      const imported = await importWorkspaceKey(workspace.id);
      if (imported) {
        const collections = await loadWorkspaceCollections(workspace.id);
        applyCollections(collections, selected.id);
        setWorkspaceKeyStatus("Encryption key imported successfully.");
      }
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "The workspace encryption key could not be imported.",
      );
    } finally {
      setIsTransferringWorkspaceKey(false);
    }
  };

  const switchWorkspace = async (id: string) => {
    if (workspace?.id === id || isSwitchingWorkspace) return;
    setIsSwitchingWorkspace(true);
    setWorkspaceError(null);
    try {
      const activated = await activateWorkspace(id);
      setWorkspace(activated);
      setWorkspaceName(activated.name);
      try {
        const [collections, storedEnvironments] = await Promise.all([
          loadWorkspaceCollections(id),
          loadWorkspaceEnvironments(id),
        ]);
        applyCollections(collections);
        applyEnvironments(storedEnvironments);
        setWorkspaceDialogOpen(false);
      } catch (error) {
        setCollectionNames([]);
        applyRequests([]);
        applyEnvironments([]);
        throw error;
      }
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "The workspace could not be opened.",
      );
    } finally {
      setIsSwitchingWorkspace(false);
    }
  };

  const openSaveRequestDialog = () => {
    if (!workspace || !urlDraft.trim()) return;
    setRequestMenuOpen(false);
    setSaveDialogPurpose("save");
    setSaveRequestName(selected.id ? selected.name : "New request");
    setSaveCollectionName(
      selected.collection || collections[0] || "My Collection",
    );
    setSaveRequestError(null);
    setSaveDialogOpen(true);
  };

  const openRenameRequestDialog = () => {
    if (!workspace || !selected.id) return;
    setRequestMenuOpen(false);
    setSaveDialogPurpose("rename");
    setSaveRequestName(selected.name);
    setSaveCollectionName(selected.collection);
    setSaveRequestError(null);
    setSaveDialogOpen(true);
  };

  const openDeleteRequestDialog = () => {
    if (!workspace || !selected.id) return;
    setRequestMenuOpen(false);
    setDeleteError(null);
    setDeleteTarget({ type: "request", id: selected.id, name: selected.name });
  };

  const createRequestDraft = () => {
    if (!workspace) return;
    setRequestMenuOpen(false);
    setSelectedId("");
    setMethodDraft("GET");
    setUrlDraft("");
    setBodyDraft("");
    setHeaderDrafts([]);
    setRequestTab("Body");
    setResponseTab("Response");
    setResponse(null);
    setRequestError(null);
    setLastRequest(null);
  };

  const submitSaveRequest = async () => {
    if (!workspace || isSavingRequest) return;
    setIsSavingRequest(true);
    setSaveRequestError(null);
    try {
      const result = await saveWorkspaceRequest(
        workspace.id,
        saveCollectionName,
        {
          id: selected.id || null,
          name: saveRequestName,
          method: methodDraft,
          path: urlDraft,
          body: bodyDraft,
          headers: headerDrafts,
        },
      );
      setWorkspace(result.workspace);
      applyCollections(result.collections, result.request.id);
      setSaveDialogOpen(false);
    } catch (error) {
      setSaveRequestError(
        error instanceof Error
          ? error.message
          : "The request could not be saved.",
      );
    } finally {
      setIsSavingRequest(false);
    }
  };

  const openRenameCollectionDialog = () => {
    if (!workspace || collections.length === 0) return;
    setCollectionMenuOpen(false);
    setCollectionDialogPurpose("rename");
    const current =
      selected.collection && collections.includes(selected.collection)
        ? selected.collection
        : collections[0];
    setRenameCollectionCurrent(current);
    setRenameCollectionName(current);
    setRenameCollectionError(null);
    setRenameCollectionDialogOpen(true);
  };

  const openCreateCollectionDialog = () => {
    if (!workspace) return;
    setCollectionMenuOpen(false);
    setCollectionDialogPurpose("create");
    setRenameCollectionCurrent("");
    setRenameCollectionName("");
    setRenameCollectionError(null);
    setRenameCollectionDialogOpen(true);
  };

  const openDeleteCollectionDialog = () => {
    if (!workspace || collections.length === 0) return;
    setCollectionMenuOpen(false);
    const name =
      selected.collection && collections.includes(selected.collection)
        ? selected.collection
        : collections[0];
    setDeleteError(null);
    setDeleteTarget({
      type: "collection",
      name,
      requestCount: requests.filter((request) => request.collection === name)
        .length,
    });
  };

  const submitDelete = async () => {
    if (!workspace || !deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result =
        deleteTarget.type === "request"
          ? await deleteWorkspaceRequest(workspace.id, deleteTarget.id)
          : await deleteWorkspaceCollection(workspace.id, deleteTarget.name);
      setWorkspace(result.workspace);
      applyCollections(result.collections);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : `The ${deleteTarget.type} could not be deleted.`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const submitRenameCollection = async () => {
    if (!workspace || isRenamingCollection) return;
    setIsRenamingCollection(true);
    setRenameCollectionError(null);
    try {
      const result =
        collectionDialogPurpose === "create"
          ? await createWorkspaceCollection(workspace.id, renameCollectionName)
          : await renameWorkspaceCollection(
              workspace.id,
              renameCollectionCurrent,
              renameCollectionName,
            );
      setWorkspace(result.workspace);
      applyCollections(result.collections, selected.id);
      setRenameCollectionDialogOpen(false);
    } catch (error) {
      setRenameCollectionError(
        error instanceof Error
          ? error.message
          : collectionDialogPurpose === "create"
            ? "The collection could not be created."
            : "The collection could not be renamed.",
      );
    } finally {
      setIsRenamingCollection(false);
    }
  };

  const loadEnvironmentDraft = (environment?: WorkspaceEnvironment) => {
    setEnvironmentDraftId(environment?.id ?? null);
    setEnvironmentName(environment?.name ?? "");
    setEnvironmentVariables(
      environment?.variables.map((variable) => ({ ...variable })) ?? [
        { name: "", value: "" },
      ],
    );
    setEnvironmentError(null);
    setEnvironmentDeletePending(false);
  };

  const openEnvironmentDialog = () => {
    if (!workspace) return;
    loadEnvironmentDraft(activeEnvironment ?? environments[0]);
    setEnvironmentDialogOpen(true);
  };

  const openCollectionRunner = () => {
    const preferredCollection =
      selected.collection && collectionNames.includes(selected.collection)
        ? selected.collection
        : (collectionNames[0] ?? "");
    if (!preferredCollection) return;
    setRunnerCollection(preferredCollection);
    setCollectionMenuOpen(false);
    setRunnerDialogOpen(true);
  };

  const updateEnvironmentVariable = (
    index: number,
    field: keyof EnvironmentVariable,
    value: string,
  ) => {
    setEnvironmentVariables((current) =>
      current.map((variable, variableIndex) =>
        variableIndex === index ? { ...variable, [field]: value } : variable,
      ),
    );
    setEnvironmentError(null);
    setEnvironmentDeletePending(false);
  };

  const submitEnvironment = async () => {
    if (!workspace || isSavingEnvironment) return;
    setIsSavingEnvironment(true);
    setEnvironmentError(null);
    try {
      const result = await saveWorkspaceEnvironment(workspace.id, {
        id: environmentDraftId,
        name: environmentName,
        variables: environmentVariables,
      });
      setWorkspace(result.workspace);
      applyEnvironments(result.environments, result.environment.id);
      loadEnvironmentDraft(result.environment);
    } catch (error) {
      setEnvironmentError(
        error instanceof Error
          ? error.message
          : "The environment could not be saved.",
      );
    } finally {
      setIsSavingEnvironment(false);
    }
  };

  const submitDeleteEnvironment = async () => {
    if (!workspace || !environmentDraftId || isDeletingEnvironment) return;
    if (!environmentDeletePending) {
      setEnvironmentDeletePending(true);
      setEnvironmentError(null);
      return;
    }
    setIsDeletingEnvironment(true);
    setEnvironmentError(null);
    try {
      const result = await deleteWorkspaceEnvironment(
        workspace.id,
        environmentDraftId,
      );
      setWorkspace(result.workspace);
      applyEnvironments(result.environments);
      loadEnvironmentDraft(result.environments[0]);
    } catch (error) {
      setEnvironmentError(
        error instanceof Error
          ? error.message
          : "The environment could not be deleted.",
      );
    } finally {
      setIsDeletingEnvironment(false);
    }
  };

  const bodyLines = (bodyDraft || "No body for this request.").split("\n");
  const responseText = response ? formatResponseBody(response) : "";
  const requestHeaderCount =
    headerDrafts.filter((header) => header.name.trim()).length +
    (bodyDraft.trim() &&
    !["GET", "HEAD"].includes(methodDraft) &&
    !headerDrafts.some(
      (header) => header.name.trim().toLowerCase() === "content-type",
    )
      ? 1
      : 0);
  const collections = collectionNames;

  const addHeader = () => {
    setHeaderDrafts((headers) => [...headers, { name: "", value: "" }]);
  };

  const updateHeader = (
    index: number,
    field: keyof RestHeader,
    value: string,
  ) => {
    setHeaderDrafts((headers) =>
      headers.map((header, headerIndex) =>
        headerIndex === index ? { ...header, [field]: value } : header,
      ),
    );
  };

  const removeHeader = (index: number) => {
    setHeaderDrafts((headers) =>
      headers.filter((_, headerIndex) => headerIndex !== index),
    );
  };

  const requestContent = () => {
    if (requestTab === "Body")
      return (
        <div className="editor-shell">
          <div aria-hidden="true" className="line-numbers">
            {bodyLines.map((_, index) => (
              <span key={index}>{index + 1}</span>
            ))}
          </div>
          <div className="template-editor">
            <pre
              aria-hidden="true"
              className="template-highlight body-template-highlight"
              ref={bodyHighlightRef}
            >
              <HighlightedTemplate
                value={bodyDraft}
                variableNames={activeVariableNames}
              />
              {bodyDraft.endsWith("\n") ? "\n" : null}
            </pre>
            <textarea
              aria-label="Request body"
              className="code-input template-text-input"
              onChange={(event) => setBodyDraft(event.target.value)}
              onScroll={(event) => {
                if (bodyHighlightRef.current) {
                  bodyHighlightRef.current.scrollLeft =
                    event.currentTarget.scrollLeft;
                  bodyHighlightRef.current.scrollTop =
                    event.currentTarget.scrollTop;
                }
              }}
              placeholder="Request body"
              spellCheck={false}
              value={bodyDraft}
            />
          </div>
        </div>
      );
    if (requestTab === "Headers") {
      if (headerDrafts.length === 0) {
        return (
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="code" size={20} />
            </div>
            <strong>Request headers</strong>
            <span>Add headers that should be sent with this request.</span>
            <button
              className="secondary-button"
              onClick={addHeader}
              type="button"
            >
              <Icon name="plus" size={15} /> Add header
            </button>
          </div>
        );
      }

      return (
        <div className="header-editor">
          <div aria-hidden="true" className="header-editor-heading">
            <span>Name</span>
            <span>Value</span>
            <span />
          </div>
          {headerDrafts.map((header, index) => (
            <div className="header-editor-row" key={index}>
              <input
                aria-label={`Header ${index + 1} name`}
                autoFocus={index === headerDrafts.length - 1 && !header.name}
                onChange={(event) =>
                  updateHeader(index, "name", event.target.value)
                }
                placeholder="Header name"
                spellCheck={false}
                value={header.name}
              />
              <input
                aria-label={`Header ${index + 1} value`}
                onChange={(event) =>
                  updateHeader(index, "value", event.target.value)
                }
                placeholder="Header value"
                spellCheck={false}
                value={header.value}
              />
              <button
                aria-label={`Remove header ${index + 1}`}
                className="icon-button compact"
                onClick={() => removeHeader(index)}
                type="button"
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          <button
            className="secondary-button add-header-button"
            onClick={addHeader}
            type="button"
          >
            <Icon name="plus" size={15} /> Add header
          </button>
        </div>
      );
    }
    const emptyStates = {
      Params: [
        "Query parameters",
        "Add URL parameters as key and value pairs.",
      ],
      Auth: [
        "Authentication",
        "Choose an authentication method for this request.",
      ],
    } as const;
    const [title, description] = emptyStates[requestTab];
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Icon name={requestTab === "Auth" ? "bolt" : "code"} size={20} />
        </div>
        <strong>{title}</strong>
        <span>{description}</span>
        <button className="secondary-button" type="button">
          <Icon name="plus" size={15} /> Add item
        </button>
      </div>
    );
  };

  return (
    <main className={`app-shell ${sidebarVisible ? "" : "sidebar-collapsed"}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </div>
          <span className="brand-name">GetRest</span>
          <span className="app-stage">preview</span>
          <span aria-label="Application version" className="app-version">
            v{__APP_VERSION__}
          </span>
        </div>
        <div className="topbar-context">
          <button
            className="workspace-switcher"
            onClick={openWorkspaceDialog}
            title={workspace?.path}
            type="button"
          >
            <span className="workspace-dot" />
            <span>{workspace?.name ?? "Create workspace"}</span>
            <Icon name="chevron-down" size={15} />
          </button>
          <span className="context-divider" />
          <select
            aria-label="Active environment"
            className="environment-selector"
            disabled={!workspace || environments.length === 0}
            onChange={(event) => setActiveEnvironmentId(event.target.value)}
            value={activeEnvironmentId}
          >
            <option value="">No environment</option>
            {environments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.name}
              </option>
            ))}
          </select>
          <button
            aria-label="Manage environments"
            className="icon-button environment-manage-button"
            disabled={!workspace}
            onClick={openEnvironmentDialog}
            type="button"
          >
            <Icon name="gear" size={16} />
          </button>
        </div>
        <div className="topbar-actions">
          <button
            aria-label="Toggle sidebar"
            className="icon-button"
            onClick={() => setSidebarVisible((value) => !value)}
            type="button"
          >
            <Icon name="sidebar" />
          </button>
          <button
            aria-label="Open command search"
            className="icon-button"
            type="button"
          >
            <Icon name="search" />
          </button>
          <button
            aria-label="Open settings"
            className="icon-button"
            type="button"
          >
            <Icon name="gear" />
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-tools">
          <label className="search-field">
            <Icon name="search" size={16} />
            <input
              aria-label="Search requests"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests"
              value={search}
            />
            <kbd>⌘ K</kbd>
          </label>
          <button
            aria-label="Add collection"
            className="icon-button compact"
            disabled={!workspace}
            onClick={openCreateCollectionDialog}
            type="button"
          >
            <Icon name="plus" />
          </button>
        </div>
        <div className="sidebar-heading">
          <span>Collections</span>
          <div className="request-menu collection-menu">
            <button
              aria-expanded={collectionMenuOpen}
              aria-haspopup="menu"
              aria-label="Collection options"
              className="icon-button compact"
              disabled={collections.length === 0}
              onClick={() => setCollectionMenuOpen((open) => !open)}
              type="button"
            >
              <Icon name="more" />
            </button>
            {collectionMenuOpen && (
              <div
                aria-label="Collection actions"
                className="request-menu-popover"
                role="menu"
              >
                <button
                  onClick={openCreateCollectionDialog}
                  role="menuitem"
                  type="button"
                >
                  <Icon name="plus" size={15} />
                  <span>
                    <strong>New collection</strong>
                    <small>Create an empty collection</small>
                  </span>
                </button>
                <button
                  disabled={!workspace || collections.length === 0}
                  onClick={openRenameCollectionDialog}
                  role="menuitem"
                  type="button"
                >
                  <Icon name="folder" size={15} />
                  <span>
                    <strong>Rename collection</strong>
                    <small>Change an existing collection name</small>
                  </span>
                </button>
                <button
                  disabled={collections.length === 0}
                  onClick={openCollectionRunner}
                  role="menuitem"
                  type="button"
                >
                  <Icon name="bolt" size={15} />
                  <span>
                    <strong>Run collection</strong>
                    <small>Build a flow or simulate API traffic</small>
                  </span>
                </button>
                <button
                  className="danger-action"
                  disabled={!workspace || collections.length === 0}
                  onClick={openDeleteCollectionDialog}
                  role="menuitem"
                  type="button"
                >
                  <Icon name="trash" size={15} />
                  <span>
                    <strong>Delete collection</strong>
                    <small>Remove it and all contained requests</small>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
        <nav aria-label="Request collections" className="collections">
          {collections.map((collection) => {
            const collectionRequests = visibleRequests.filter(
              (request) => request.collection === collection,
            );
            if (search && collectionRequests.length === 0) return null;
            const isCollapsed = collapsedCollections.includes(collection);
            return (
              <div className="collection" key={collection}>
                <button
                  className="collection-title"
                  onClick={() => toggleCollection(collection)}
                  type="button"
                >
                  <Icon
                    name={isCollapsed ? "chevron-right" : "chevron-down"}
                    size={15}
                  />
                  <Icon name="folder" size={17} />
                  <span>{collection}</span>
                  <small>{collectionRequests.length}</small>
                </button>
                {!isCollapsed && (
                  <div className="request-list">
                    {collectionRequests.map((request) => (
                      <button
                        aria-current={
                          selectedId === request.id ? "page" : undefined
                        }
                        className={`request-item ${selectedId === request.id ? "selected" : ""}`}
                        key={request.id}
                        onClick={() => selectRequest(request)}
                        type="button"
                      >
                        <MethodBadge method={request.method} />
                        <span className="request-name">{request.name}</span>
                        <span
                          className={`status-dot ${
                            selectedId === request.id &&
                            response &&
                            response.status < 400
                              ? "success"
                              : ""
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {visibleRequests.length === 0 && (
            <p className="no-results">No requests found.</p>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="branch-button" type="button">
            <Icon name="archive" size={15} />{" "}
            {workspaceStatusLabel(workspace?.gitState)}
          </button>
          <button
            aria-label="Workspace settings"
            className="icon-button compact"
            type="button"
          >
            <Icon name="gear" size={17} />
          </button>
        </div>
      </aside>

      <section className="request-panel panel">
        <div className="panel-titlebar">
          <div>
            <span className="eyebrow">Request</span>
            <h1>{selected.name}</h1>
          </div>
          <div className="request-title-actions">
            <button
              className="secondary-button save-request-button"
              disabled={!workspace || !urlDraft.trim()}
              onClick={openSaveRequestDialog}
              title={
                workspace
                  ? "Save this request"
                  : "Create or select a workspace first"
              }
              type="button"
            >
              <Icon name="save" size={15} />
              Save
            </button>
            <div className="request-menu">
              <button
                aria-expanded={requestMenuOpen}
                aria-haspopup="menu"
                aria-label="Request options"
                className="icon-button"
                onClick={() => setRequestMenuOpen((open) => !open)}
                type="button"
              >
                <Icon name="more" />
              </button>
              {requestMenuOpen && (
                <div
                  aria-label="Request actions"
                  className="request-menu-popover"
                  role="menu"
                >
                  <button
                    disabled={!workspace}
                    onClick={createRequestDraft}
                    role="menuitem"
                    type="button"
                  >
                    <Icon name="plus" size={15} />
                    <span>
                      <strong>New request</strong>
                      <small>Start with an empty draft</small>
                    </span>
                  </button>
                  <button
                    disabled={!workspace || !selected.id}
                    onClick={openRenameRequestDialog}
                    role="menuitem"
                    type="button"
                  >
                    <Icon name="code" size={15} />
                    <span>
                      <strong>Rename request</strong>
                      <small>Change the selected item name</small>
                    </span>
                  </button>
                  <button
                    className="danger-action"
                    disabled={!workspace || !selected.id}
                    onClick={openDeleteRequestDialog}
                    role="menuitem"
                    type="button"
                  >
                    <Icon name="trash" size={15} />
                    <span>
                      <strong>Delete request</strong>
                      <small>Remove the selected saved item</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <form
          className="request-bar"
          onSubmit={(event) => {
            event.preventDefault();
            sendRequest();
          }}
        >
          <select
            aria-label="HTTP method"
            className={`method-select method-${methodDraft.toLowerCase()}`}
            value={methodDraft}
            onChange={(event) =>
              setMethodDraft(event.target.value as HttpMethod)
            }
          >
            {methods.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
          <div className="url-template-shell">
            <div
              aria-hidden="true"
              className="template-highlight url-template-highlight"
              ref={urlHighlightRef}
            >
              <HighlightedTemplate
                value={urlDraft}
                variableNames={activeVariableNames}
              />
            </div>
            <input
              aria-label="Request URL"
              className="url-input template-text-input"
              onChange={(event) => setUrlDraft(event.target.value)}
              onScroll={(event) => {
                if (urlHighlightRef.current) {
                  urlHighlightRef.current.scrollLeft =
                    event.currentTarget.scrollLeft;
                }
              }}
              spellCheck={false}
              value={urlDraft}
            />
          </div>
          <button
            className="send-button"
            disabled={isSending || !urlDraft.trim()}
            type="submit"
          >
            <span>{isSending ? "Sending" : "Send"}</span>
            <Icon name="send" size={17} />
          </button>
        </form>
        <div className="tabs" role="tablist" aria-label="Request details">
          {requestTabs.map((tab) => (
            <button
              aria-selected={requestTab === tab}
              className={requestTab === tab ? "active" : ""}
              key={tab}
              onClick={() => setRequestTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
              {tab === "Headers" && requestHeaderCount > 0 && (
                <span className="count-badge">{requestHeaderCount}</span>
              )}
            </button>
          ))}
        </div>
        <div className="editor-toolbar">
          {requestTab === "Body" ? (
            <button className="format-select" type="button">
              <Icon name="code" size={16} /> JSON{" "}
              <Icon name="chevron-down" size={14} />
            </button>
          ) : (
            <span>{requestTab}</span>
          )}
          <span>
            {requestTab === "Body"
              ? bodyDraft
                ? `${bodyDraft.split("\n").length} lines`
                : "Empty body"
              : requestTab === "Headers"
                ? `${requestHeaderCount} ${requestHeaderCount === 1 ? "header" : "headers"}`
                : "Not configured"}
          </span>
        </div>
        <div className="request-content">{requestContent()}</div>
      </section>

      <section className="response-panel panel">
        <div aria-live="polite" className="response-summary">
          <div className="response-metrics">
            {response ? (
              <>
                <strong className={response.status >= 400 ? "error" : ""}>
                  {response.status} {response.statusText}
                </strong>
                <span />
                <span>{response.durationMs} ms</span>
                <span />
                <span>{formatBytes(response.sizeBytes)}</span>
              </>
            ) : (
              <strong className={requestError ? "error" : "idle"}>
                {isSending
                  ? "Sending request…"
                  : requestError
                    ? "Request failed"
                    : "Ready to send"}
              </strong>
            )}
          </div>
          <div>
            <button
              aria-label="Copy response"
              className="icon-button"
              disabled={!response}
              onClick={copyResponse}
              type="button"
            >
              <Icon name="copy" />
            </button>
            <button
              aria-label="Response history"
              className="icon-button"
              type="button"
            >
              <Icon name="history" />
            </button>
          </div>
        </div>
        <div
          className="tabs response-tabs"
          role="tablist"
          aria-label="Response details"
        >
          {responseTabs.map((tab) => (
            <button
              aria-selected={responseTab === tab}
              className={responseTab === tab ? "active" : ""}
              key={tab}
              onClick={() => setResponseTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
              {tab === "Headers" && response && (
                <span className="count-badge">{response.headers.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="response-toolbar">
          <span>
            <span
              className={`live-dot ${requestError ? "error" : response ? "" : "idle"}`}
            />{" "}
            {response?.contentType?.toLowerCase().includes("json")
              ? "Pretty JSON"
              : response
                ? response.contentType || "Plain text"
                : "Native response"}
          </span>
          <button className="plain-button" type="button">
            Wrap lines
          </button>
        </div>
        <div className="response-content">
          {responseTab === "Response" ? (
            response ? (
              <div className="response-code">
                <div aria-hidden="true" className="line-numbers response-lines">
                  {(responseText || " ").split("\n").map((_, index) => (
                    <span key={index}>{index + 1}</span>
                  ))}
                </div>
                <pre aria-label="Response body">
                  {responseText || "Empty response body"}
                </pre>
              </div>
            ) : (
              <div className="empty-state response-empty">
                <div className={`empty-icon ${requestError ? "error" : ""}`}>
                  <Icon name={requestError ? "bolt" : "send"} size={20} />
                </div>
                <strong>
                  {requestError
                    ? "The request could not be completed"
                    : isSending
                      ? "Waiting for the API"
                      : "Send a request to view its response"}
                </strong>
                <span>
                  {requestError ??
                    (isSending
                      ? "The native Rust engine is executing the request."
                      : "The status, timing, headers, and body will appear here.")}
                </span>
              </div>
            )
          ) : responseTab === "Headers" ? (
            response ? (
              <dl aria-label="Response headers" className="header-list">
                {response.headers.map((header, index) => (
                  <div key={`${header.name}-${index}`}>
                    <dt>{header.name}</dt>
                    <dd>{header.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="empty-state response-empty">
                <strong>No response headers yet</strong>
                <span>Send a request to inspect the returned headers.</span>
              </div>
            )
          ) : (
            <div className="request-snapshot">
              {lastRequest ? (
                <pre aria-label="Request snapshot">
                  {JSON.stringify(lastRequest, null, 2)}
                </pre>
              ) : (
                <div className="empty-state response-empty">
                  <div className="empty-icon">
                    <Icon name="clock" size={20} />
                  </div>
                  <strong>No request sent yet</strong>
                  <span>The exact request snapshot will appear here.</span>
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="response-footer">
          <span>
            <Icon name="bolt" size={14} /> Native Rust engine
          </span>
          <span>
            {response
              ? "Response received just now"
              : requestError
                ? "Check the URL and try again"
                : "Waiting for a request"}
          </span>
        </footer>
      </section>
      {runnerDialogOpen && (
        <CollectionRunnerDialog
          collections={collections}
          initialCollection={runnerCollection}
          onClose={() => setRunnerDialogOpen(false)}
          requests={requests}
          variables={activeEnvironment?.variables ?? []}
        />
      )}
      {environmentDialogOpen && (
        <div className="modal-backdrop">
          <section
            aria-labelledby="environment-dialog-title"
            aria-modal="true"
            className="workspace-dialog environment-dialog"
            role="dialog"
          >
            <header className="workspace-dialog-header">
              <div>
                <span className="eyebrow">Workspace variables</span>
                <h2 id="environment-dialog-title">Environments</h2>
              </div>
              <button
                aria-label="Close environment dialog"
                className="icon-button workspace-close-button"
                disabled={isSavingEnvironment || isDeletingEnvironment}
                onClick={() => setEnvironmentDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="workspace-dialog-content environment-content">
              <div className="environment-toolbar">
                <label className="workspace-field">
                  <span>Environment to edit</span>
                  <select
                    aria-label="Environment to edit"
                    disabled={environments.length === 0}
                    onChange={(event) =>
                      loadEnvironmentDraft(
                        environments.find(
                          (environment) =>
                            environment.id === event.target.value,
                        ),
                      )
                    }
                    value={environmentDraftId ?? ""}
                  >
                    {environmentDraftId === null && (
                      <option value="">New environment</option>
                    )}
                    {environments.map((environment) => (
                      <option key={environment.id} value={environment.id}>
                        {environment.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary-button"
                  onClick={() => loadEnvironmentDraft()}
                  type="button"
                >
                  <Icon name="plus" size={15} /> New environment
                </button>
              </div>
              <label className="workspace-field">
                <span>Environment name</span>
                <input
                  aria-label="Environment name"
                  autoFocus
                  maxLength={100}
                  onChange={(event) => {
                    setEnvironmentName(event.target.value);
                    setEnvironmentError(null);
                    setEnvironmentDeletePending(false);
                  }}
                  placeholder="Development"
                  value={environmentName}
                />
              </label>
              <div className="environment-variables">
                <div className="environment-variables-heading">
                  <span>Variable</span>
                  <span>Value</span>
                  <span />
                </div>
                {environmentVariables.map((variable, index) => (
                  <div className="environment-variable-row" key={index}>
                    <input
                      aria-label={`Variable name ${index + 1}`}
                      maxLength={100}
                      onChange={(event) =>
                        updateEnvironmentVariable(
                          index,
                          "name",
                          event.target.value,
                        )
                      }
                      placeholder="baseUrl"
                      value={variable.name}
                    />
                    <input
                      aria-label={`Variable value ${index + 1}`}
                      onChange={(event) =>
                        updateEnvironmentVariable(
                          index,
                          "value",
                          event.target.value,
                        )
                      }
                      placeholder="https://api.example.com"
                      value={variable.value}
                    />
                    <button
                      aria-label={`Remove variable ${index + 1}`}
                      className="icon-button"
                      disabled={environmentVariables.length === 1}
                      onClick={() =>
                        setEnvironmentVariables((current) =>
                          current.filter(
                            (_, variableIndex) => variableIndex !== index,
                          ),
                        )
                      }
                      type="button"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
                <button
                  className="plain-button add-variable-button"
                  disabled={environmentVariables.length >= 200}
                  onClick={() =>
                    setEnvironmentVariables((current) => [
                      ...current,
                      { name: "", value: "" },
                    ])
                  }
                  type="button"
                >
                  <Icon name="plus" size={14} /> Add variable
                </button>
              </div>
              <div className="environment-security-note">
                Use variables as <code>{"{{baseUrl}}"}</code> in request URLs or
                bodies. These values are stored in workspace Git; do not add
                passwords, tokens, API keys, or other secrets.
              </div>
              {environmentDeletePending && (
                <div className="delete-warning">
                  Select “Confirm delete” to remove this environment file. The
                  change remains recoverable through Git until it is committed.
                </div>
              )}
              {environmentError && (
                <div aria-live="polite" className="workspace-error">
                  {environmentError}
                </div>
              )}
            </div>
            <footer className="workspace-dialog-actions">
              {environmentDraftId && (
                <button
                  className="plain-button environment-delete-button"
                  disabled={isSavingEnvironment || isDeletingEnvironment}
                  onClick={submitDeleteEnvironment}
                  type="button"
                >
                  {isDeletingEnvironment
                    ? "Deleting…"
                    : environmentDeletePending
                      ? "Confirm delete"
                      : "Delete environment"}
                </button>
              )}
              <button
                className="plain-button"
                disabled={isSavingEnvironment || isDeletingEnvironment}
                onClick={() => setEnvironmentDialogOpen(false)}
                type="button"
              >
                Close
              </button>
              <button
                className="send-button workspace-create-button"
                disabled={
                  isSavingEnvironment ||
                  isDeletingEnvironment ||
                  !environmentName.trim()
                }
                onClick={submitEnvironment}
                type="button"
              >
                {isSavingEnvironment ? "Saving…" : "Save environment"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {deleteTarget && (
        <div className="modal-backdrop">
          <section
            aria-labelledby="delete-dialog-title"
            aria-modal="true"
            className="workspace-dialog save-request-dialog"
            role="dialog"
          >
            <header className="workspace-dialog-header">
              <div>
                <span className="eyebrow">Permanent workspace change</span>
                <h2 id="delete-dialog-title">Delete {deleteTarget.type}</h2>
              </div>
              <button
                aria-label="Close delete dialog"
                className="icon-button workspace-close-button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="workspace-dialog-content">
              {deleteTarget.type === "collection" && (
                <label className="workspace-field">
                  <span>Collection</span>
                  <select
                    aria-label="Collection to delete"
                    autoFocus
                    disabled={isDeleting}
                    onChange={(event) => {
                      const name = event.target.value;
                      setDeleteError(null);
                      setDeleteTarget({
                        type: "collection",
                        name,
                        requestCount: requests.filter(
                          (request) => request.collection === name,
                        ).length,
                      });
                    }}
                    value={deleteTarget.name}
                  >
                    {collections.map((collection) => (
                      <option key={collection} value={collection}>
                        {collection}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p>
                {deleteTarget.type === "request"
                  ? `Delete “${deleteTarget.name}” from its collection?`
                  : `Delete “${deleteTarget.name}” and ${deleteTarget.requestCount} contained ${deleteTarget.requestCount === 1 ? "request" : "requests"}?`}
              </p>
              <div className="delete-warning">
                The files will be removed from the workspace without creating an
                automatic Git commit. You can review or restore the change with
                Git until it is committed.
              </div>
              {deleteError && (
                <div aria-live="polite" className="workspace-error">
                  {deleteError}
                </div>
              )}
            </div>
            <footer className="workspace-dialog-actions">
              <button
                className="plain-button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="danger-button"
                disabled={isDeleting}
                onClick={submitDelete}
                type="button"
              >
                {isDeleting ? "Deleting…" : `Delete ${deleteTarget.type}`}
              </button>
            </footer>
          </section>
        </div>
      )}
      {renameCollectionDialogOpen && (
        <div className="modal-backdrop">
          <section
            aria-labelledby="collection-dialog-title"
            aria-modal="true"
            className="workspace-dialog save-request-dialog"
            role="dialog"
          >
            <header className="workspace-dialog-header">
              <div>
                <span className="eyebrow">Workspace collection</span>
                <h2 id="collection-dialog-title">
                  {collectionDialogPurpose === "create"
                    ? "Create collection"
                    : "Rename collection"}
                </h2>
              </div>
              <button
                aria-label="Close collection dialog"
                className="icon-button workspace-close-button"
                onClick={() => setRenameCollectionDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="workspace-dialog-content">
              <p>
                {collectionDialogPurpose === "create"
                  ? "Create an empty collection in the active workspace. You can add requests to it whenever you are ready."
                  : "Choose a collection and update its name. All contained requests keep their identifiers and order."}
              </p>
              {collectionDialogPurpose === "rename" && (
                <label className="workspace-field">
                  <span>Collection</span>
                  <select
                    aria-label="Collection to rename"
                    onChange={(event) => {
                      setRenameCollectionCurrent(event.target.value);
                      setRenameCollectionName(event.target.value);
                      setRenameCollectionError(null);
                    }}
                    value={renameCollectionCurrent}
                  >
                    {collections.map((collection) => (
                      <option key={collection} value={collection}>
                        {collection}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="workspace-field">
                <span>
                  {collectionDialogPurpose === "create"
                    ? "Collection name"
                    : "New collection name"}
                </span>
                <input
                  aria-label={
                    collectionDialogPurpose === "create"
                      ? "Collection name"
                      : "New collection name"
                  }
                  autoFocus
                  maxLength={100}
                  onChange={(event) => {
                    setRenameCollectionName(event.target.value);
                    setRenameCollectionError(null);
                  }}
                  value={renameCollectionName}
                />
              </label>
              {renameCollectionError && (
                <div aria-live="polite" className="workspace-error">
                  {renameCollectionError}
                </div>
              )}
            </div>
            <footer className="workspace-dialog-actions">
              <button
                className="plain-button"
                onClick={() => setRenameCollectionDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="send-button workspace-create-button"
                disabled={
                  isRenamingCollection ||
                  !renameCollectionName.trim() ||
                  (collectionDialogPurpose === "rename" &&
                    renameCollectionName.trim() === renameCollectionCurrent)
                }
                onClick={submitRenameCollection}
                type="button"
              >
                {isRenamingCollection
                  ? collectionDialogPurpose === "create"
                    ? "Creating…"
                    : "Renaming…"
                  : collectionDialogPurpose === "create"
                    ? "Create collection"
                    : "Rename collection"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {saveDialogOpen && (
        <div className="modal-backdrop">
          <section
            aria-labelledby="save-request-dialog-title"
            aria-modal="true"
            className="workspace-dialog save-request-dialog"
            role="dialog"
          >
            <header className="workspace-dialog-header">
              <div>
                <span className="eyebrow">Workspace item</span>
                <h2 id="save-request-dialog-title">
                  {saveDialogPurpose === "rename"
                    ? "Rename request"
                    : "Save request"}
                </h2>
              </div>
              <button
                aria-label="Close save request dialog"
                className="icon-button workspace-close-button"
                onClick={() => setSaveDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="workspace-dialog-content">
              <p>
                {saveDialogPurpose === "rename"
                  ? "Change the item name without changing its method, URL, body, or collection."
                  : "Save the current method, URL, body, and encrypted header values in the workspace repository. Existing items are updated without creating an automatic Git commit."}
              </p>
              <label className="workspace-field">
                <span>Request name</span>
                <input
                  aria-label="Request name"
                  autoFocus
                  maxLength={200}
                  onChange={(event) => setSaveRequestName(event.target.value)}
                  value={saveRequestName}
                />
              </label>
              {saveDialogPurpose === "save" && (
                <label className="workspace-field">
                  <span>Collection</span>
                  <input
                    aria-label="Collection"
                    list="workspace-collections"
                    maxLength={100}
                    onChange={(event) =>
                      setSaveCollectionName(event.target.value)
                    }
                    value={saveCollectionName}
                  />
                  <datalist id="workspace-collections">
                    {collections.map((collection) => (
                      <option key={collection} value={collection} />
                    ))}
                  </datalist>
                </label>
              )}
              <div className="request-save-preview">
                <MethodBadge method={methodDraft} />
                <span>{urlDraft}</span>
              </div>
              {saveRequestError && (
                <div aria-live="polite" className="workspace-error">
                  {saveRequestError}
                </div>
              )}
            </div>
            <footer className="workspace-dialog-actions">
              <button
                className="plain-button"
                onClick={() => setSaveDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="send-button workspace-create-button"
                disabled={
                  isSavingRequest ||
                  !saveRequestName.trim() ||
                  !saveCollectionName.trim()
                }
                onClick={submitSaveRequest}
                type="button"
              >
                {isSavingRequest
                  ? "Saving…"
                  : saveDialogPurpose === "rename"
                    ? "Rename request"
                    : "Save request"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {workspaceDialogOpen && (
        <div className="modal-backdrop">
          <section
            aria-labelledby="workspace-dialog-title"
            aria-modal="true"
            className="workspace-dialog"
            role="dialog"
          >
            <header className="workspace-dialog-header">
              <div>
                <span className="eyebrow">Local-first workspace</span>
                <h2 id="workspace-dialog-title">
                  {workspaceDialogMode === "create"
                    ? "Create workspace"
                    : "Workspaces"}
                </h2>
              </div>
              <button
                aria-label="Close workspace dialog"
                className="icon-button workspace-close-button"
                onClick={() => setWorkspaceDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="workspace-dialog-content">
              {workspaceDialogMode === "manage" && workspace ? (
                <>
                  <div className="workspace-list" aria-label="Saved workspaces">
                    {knownWorkspaces.map((item) => (
                      <button
                        aria-current={
                          item.id === workspace.id ? "true" : undefined
                        }
                        className="workspace-list-item"
                        disabled={isSwitchingWorkspace}
                        key={item.id}
                        onClick={() => switchWorkspace(item.id)}
                        type="button"
                      >
                        <span className="workspace-dot" />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.path}</small>
                        </span>
                        {item.id === workspace.id && <em>Active</em>}
                      </button>
                    ))}
                  </div>
                  <label className="workspace-field">
                    <span>Workspace name</span>
                    <div>
                      <input
                        aria-label="Workspace name"
                        maxLength={100}
                        onChange={(event) =>
                          setWorkspaceName(event.target.value)
                        }
                        value={workspaceName}
                      />
                      <button
                        className="secondary-button"
                        disabled={
                          isRenamingWorkspace ||
                          !workspaceName.trim() ||
                          workspaceName.trim() === workspace.name
                        }
                        onClick={submitWorkspaceRename}
                        type="button"
                      >
                        {isRenamingWorkspace ? "Saving…" : "Rename"}
                      </button>
                    </div>
                  </label>
                  <section className="workspace-key-card">
                    <div>
                      <strong>Workspace encryption key</strong>
                      <small>
                        Header values are encrypted. Export the key only when
                        you need to open this workspace on another machine.
                      </small>
                    </div>
                    <div>
                      <button
                        className="secondary-button"
                        disabled={isTransferringWorkspaceKey}
                        onClick={exportActiveWorkspaceKey}
                        type="button"
                      >
                        Export key
                      </button>
                      <button
                        className="secondary-button"
                        disabled={isTransferringWorkspaceKey}
                        onClick={importActiveWorkspaceKey}
                        type="button"
                      >
                        Import key
                      </button>
                    </div>
                  </section>
                  {workspaceKeyStatus && (
                    <div aria-live="polite" className="workspace-key-status">
                      {workspaceKeyStatus}
                    </div>
                  )}
                  <button
                    className="new-workspace-card"
                    onClick={beginNewWorkspace}
                    type="button"
                  >
                    <Icon name="plus" size={18} />
                    <span>
                      <strong>Create a new workspace</strong>
                      <small>Choose another empty, dedicated folder.</small>
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <p>
                    Choose an empty folder. GetRest will create a dedicated Git
                    repository that remains separate from the application
                    source.
                  </p>
                  <label className="workspace-field">
                    <span>Workspace folder</span>
                    <div>
                      <input
                        aria-label="Workspace folder"
                        placeholder="No folder selected"
                        readOnly
                        value={workspaceDirectory}
                      />
                      <button
                        className="secondary-button"
                        onClick={chooseWorkspaceFolder}
                        type="button"
                      >
                        Choose folder
                      </button>
                    </div>
                  </label>
                  <fieldset className="workspace-content-choice">
                    <legend>Initial content</legend>
                    <label>
                      <input
                        checked={workspaceContent === "move"}
                        disabled={requests.length === 0}
                        name="workspace-content"
                        onChange={() => setWorkspaceContent("move")}
                        type="radio"
                      />
                      <span>
                        <strong>Move current collections</strong>
                        <small>
                          Add {collections.length}{" "}
                          {collections.length === 1
                            ? "collection"
                            : "collections"}{" "}
                          and {requests.length} requests to the new repository.
                        </small>
                      </span>
                    </label>
                    <label>
                      <input
                        checked={workspaceContent === "empty"}
                        name="workspace-content"
                        onChange={() => setWorkspaceContent("empty")}
                        type="radio"
                      />
                      <span>
                        <strong>Start with an empty workspace</strong>
                        <small>
                          Create the repository without collections.
                        </small>
                      </span>
                    </label>
                  </fieldset>
                  {gitIdentityRequired && (
                    <div className="git-identity-fields">
                      <div className="identity-callout">
                        Git needs an author for the initial commit. These values
                        will be stored only in this workspace repository.
                      </div>
                      <label className="workspace-field">
                        <span>Git author name</span>
                        <input
                          aria-label="Git author name"
                          autoComplete="name"
                          onChange={(event) =>
                            setGitAuthorName(event.target.value)
                          }
                          value={gitAuthorName}
                        />
                      </label>
                      <label className="workspace-field">
                        <span>Git author email</span>
                        <input
                          aria-label="Git author email"
                          autoComplete="email"
                          onChange={(event) =>
                            setGitAuthorEmail(event.target.value)
                          }
                          type="email"
                          value={gitAuthorEmail}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
              {workspaceError && (
                <div aria-live="polite" className="workspace-error">
                  {workspaceError}
                </div>
              )}
            </div>
            <footer className="workspace-dialog-actions">
              <button
                className="plain-button"
                onClick={() => setWorkspaceDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>
              {workspaceDialogMode === "create" && (
                <button
                  className="send-button workspace-create-button"
                  disabled={
                    !workspaceDirectory ||
                    isCreatingWorkspace ||
                    (gitIdentityRequired &&
                      (!gitAuthorName.trim() || !gitAuthorEmail.trim()))
                  }
                  onClick={submitWorkspace}
                  type="button"
                >
                  {isCreatingWorkspace ? "Creating…" : "Create workspace"}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
