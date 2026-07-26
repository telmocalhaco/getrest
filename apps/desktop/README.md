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
preserving stable request identifiers. Saved JSON changes remain uncommitted for review.
The request options menu starts a new empty draft or renames the selected
request without crowding the main request toolbar.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
