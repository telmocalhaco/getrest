import { useMemo, useState } from "react";
import "./App.css";

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
  | "send"
  | "sidebar";
type Method = "GET" | "POST" | "PUT" | "PATCH";

interface RequestExample {
  id: string;
  name: string;
  method: Method;
  path: string;
  collection: string;
  body: string;
  status: number;
  duration: number;
  size: string;
  response: object;
}

const requests: RequestExample[] = [
  {
    id: "health",
    name: "Health check",
    method: "GET",
    path: "{{BASE_URL}}/v1/health",
    collection: "Essentials",
    body: "",
    status: 200,
    duration: 38,
    size: "248 B",
    response: {
      status: "healthy",
      version: "0.1.0",
      services: { database: "ready", secrets: "ready" },
    },
  },
  {
    id: "authenticate",
    name: "Authenticate",
    method: "POST",
    path: "{{BASE_URL}}/v1/authenticate",
    collection: "Essentials",
    body: '{\n  "email": "developer@example.com",\n  "password": "{{PASSWORD}}"\n}',
    status: 200,
    duration: 94,
    size: "1.2 KB",
    response: {
      user: { id: "usr_local_01", name: "Local developer" },
      session: { expiresIn: 3600, scope: ["read", "write"] },
    },
  },
  {
    id: "profile",
    name: "User profile",
    method: "GET",
    path: "{{BASE_URL}}/v1/me",
    collection: "Essentials",
    body: "",
    status: 200,
    duration: 51,
    size: "684 B",
    response: {
      id: "usr_local_01",
      name: "Local developer",
      preferences: { locale: "pt-PT", theme: "dark" },
    },
  },
  {
    id: "create-project",
    name: "Create project",
    method: "POST",
    path: "{{BASE_URL}}/v1/projects",
    collection: "Sandbox",
    body: '{\n  "name": "GetRest demo",\n  "visibility": "private"\n}',
    status: 201,
    duration: 73,
    size: "512 B",
    response: { id: "prj_8f31", name: "GetRest demo", visibility: "private" },
  },
  {
    id: "update-project",
    name: "Update project",
    method: "PATCH",
    path: "{{BASE_URL}}/v1/projects/prj_8f31",
    collection: "Sandbox",
    body: '{\n  "name": "GetRest desktop"\n}',
    status: 200,
    duration: 61,
    size: "498 B",
    response: { id: "prj_8f31", name: "GetRest desktop", updated: true },
  },
];

const requestTabs = ["Body", "Params", "Headers", "Auth"] as const;
const responseTabs = ["Response", "Request", "Headers"] as const;

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
    send: <path d="m4 4 17 8-17 8 3-8zm3 8h14" />,
    sidebar: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 4v16" />
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

function MethodBadge({ method }: { method: Method }) {
  return (
    <span className={`method method-${method.toLowerCase()}`}>{method}</span>
  );
}

function App() {
  const [selectedId, setSelectedId] = useState("authenticate");
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
  const [runCount, setRunCount] = useState(0);
  const selected =
    requests.find((request) => request.id === selectedId) ?? requests[0];
  const [urlDraft, setUrlDraft] = useState(selected.path);
  const [bodyDraft, setBodyDraft] = useState(selected.body);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? requests.filter((request) =>
          `${request.name} ${request.path} ${request.method}`
            .toLowerCase()
            .includes(query),
        )
      : requests;
  }, [search]);

  const selectRequest = (request: RequestExample) => {
    setSelectedId(request.id);
    setUrlDraft(request.path);
    setBodyDraft(request.body);
    setResponseTab("Response");
  };

  const toggleCollection = (collection: string) =>
    setCollapsedCollections((current) =>
      current.includes(collection)
        ? current.filter((name) => name !== collection)
        : [...current, collection],
    );

  const sendRequest = () => {
    if (isSending) return;
    setIsSending(true);
    window.setTimeout(() => {
      setRunCount((count) => count + 1);
      setIsSending(false);
    }, 650);
  };

  const copyResponse = async () =>
    navigator.clipboard?.writeText(JSON.stringify(selected.response, null, 2));
  const bodyLines = (bodyDraft || "No body for this request.").split("\n");
  const responseText = JSON.stringify(selected.response, null, 2);
  const collections = ["Essentials", "Sandbox"];

  const requestContent = () => {
    if (requestTab === "Body")
      return (
        <div className="editor-shell">
          <div aria-hidden="true" className="line-numbers">
            {bodyLines.map((_, index) => (
              <span key={index}>{index + 1}</span>
            ))}
          </div>
          <textarea
            aria-label="Request body"
            className="code-input"
            onChange={(event) => setBodyDraft(event.target.value)}
            placeholder="Request body"
            spellCheck={false}
            value={bodyDraft}
          />
        </div>
      );
    const emptyStates = {
      Params: [
        "Query parameters",
        "Add URL parameters as key and value pairs.",
      ],
      Headers: [
        "Request headers",
        "Add headers that should be sent with this request.",
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
        </div>
        <div className="workspace-switcher">
          <span className="workspace-dot" />
          <span>Local workspace</span>
          <Icon name="chevron-down" size={15} />
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
            type="button"
          >
            <Icon name="plus" />
          </button>
        </div>
        <div className="sidebar-heading">
          <span>Collections</span>
          <button
            aria-label="Collection options"
            className="icon-button compact"
            type="button"
          >
            <Icon name="more" />
          </button>
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
                          className={`status-dot ${request.status < 300 ? "success" : ""}`}
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
            <Icon name="archive" size={15} /> Local only
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
          <button
            aria-label="Request options"
            className="icon-button"
            type="button"
          >
            <Icon name="more" />
          </button>
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
            className={`method-select method-${selected.method.toLowerCase()}`}
            value={selected.method}
            onChange={() => undefined}
          >
            <option>{selected.method}</option>
          </select>
          <input
            aria-label="Request URL"
            className="url-input"
            onChange={(event) => setUrlDraft(event.target.value)}
            spellCheck={false}
            value={urlDraft}
          />
          <button className="send-button" disabled={isSending} type="submit">
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
              {tab === "Headers" && <span className="count-badge">3</span>}
            </button>
          ))}
        </div>
        <div className="editor-toolbar">
          <button className="format-select" type="button">
            <Icon name="code" size={16} /> JSON{" "}
            <Icon name="chevron-down" size={14} />
          </button>
          <span>
            {bodyDraft ? `${bodyDraft.split("\n").length} lines` : "Empty body"}
          </span>
        </div>
        <div className="request-content">{requestContent()}</div>
      </section>

      <section className="response-panel panel">
        <div className="response-summary">
          <div className="response-metrics">
            <strong>
              {selected.status} {selected.status === 201 ? "Created" : "OK"}
            </strong>
            <span />
            <span>{selected.duration + runCount * 2} ms</span>
            <span />
            <span>{selected.size}</span>
          </div>
          <div>
            <button
              aria-label="Copy response"
              className="icon-button"
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
              {tab === "Headers" && <span className="count-badge">6</span>}
            </button>
          ))}
        </div>
        <div className="response-toolbar">
          <span>
            <span className="live-dot" /> Pretty JSON
          </span>
          <button className="plain-button" type="button">
            Wrap lines
          </button>
        </div>
        <div className="response-content">
          {responseTab === "Response" ? (
            <div className="response-code">
              <div aria-hidden="true" className="line-numbers response-lines">
                {responseText.split("\n").map((_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
              <pre aria-label="Response body">{responseText}</pre>
            </div>
          ) : (
            <div className="empty-state response-empty">
              <div className="empty-icon">
                <Icon
                  name={responseTab === "Headers" ? "layout" : "clock"}
                  size={20}
                />
              </div>
              <strong>
                {responseTab === "Headers"
                  ? "Response headers"
                  : "Request snapshot"}
              </strong>
              <span>
                {responseTab === "Headers"
                  ? "6 response headers received."
                  : "Inspect the exact request sent by the Rust engine."}
              </span>
            </div>
          )}
        </div>
        <footer className="response-footer">
          <span>
            <Icon name="bolt" size={14} /> Local engine
          </span>
          <span>
            {runCount
              ? `Updated just now · Run ${runCount + 1}`
              : "Example response"}
          </span>
        </footer>
      </section>
    </main>
  );
}

export default App;
