# GetRest desktop

Tauri 2 desktop shell and React interface for GetRest.

From the repository root:

```bash
npm install
npm run dev
npm run test
npm run build
npm run tauri -- dev
```

The current interface includes an initial REST request flow through a typed
Tauri boundary and the native Rust engine. It supports HTTP methods, URL and
JSON body input, response status, timing, headers, body rendering, a 30-second
timeout, and a 10 MiB response limit.

It also creates and switches between local workspaces in empty folders selected
by the user. Each workspace receives a dedicated Git repository and initial
commit. The user can start empty or include the currently loaded collections,
rename the workspace, and keep its location in GetRest's local SQLite registry.
The request editor can create or update collection items through an explicit
save action. The collection options menu can create an empty collection or
rename an existing one. Requests and collections can also be renamed while
preserving stable request identifiers. Both can be deleted through an explicit
confirmation; deleting the last request preserves its empty collection, while
deleting a collection removes all of its requests. Saved and deleted JSON
changes remain uncommitted for review or recovery through Git. The request
options menu starts a new empty draft or manages the selected request without
crowding the main request toolbar.

The active workspace can define non-secret environments in versioned JSON
files. Select an environment in the top bar and use variables such as
`{{baseUrl}}` in request URLs or JSON bodies. The native Rust engine replaces
the placeholders immediately before validating and sending the request.
Resolution is intentionally single-pass. Environment files must never contain
passwords, tokens, API keys, or other secrets; protected variables will use the
operating system credential store in a later implementation.

The collection options menu also opens a native collection runner. Requests can
be reordered into a flow, and JSON response values can be extracted by dotted
paths into variables used by later steps. Functional mode runs the flow once;
load mode supports isolated virtual users, iterations, and think time, with a
hard limit of 10,000 requests per run. The result reports per-step success,
average and p95 latency, throughput, and bounded error samples without
persisting response bodies.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
