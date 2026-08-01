# V21 Gate H Product and Connected-Agent Evidence

Recorded: **2026-08-01**  
Implementation commit: `e453329`

## Result

Project/Export now owns one exact STEP workflow for all active bodies, the
currently selected semantic body, or an explicit ordered subset. Native
checkboxes and Earlier/Later controls preserve requested order. The panel shows
the named AP242DIS schema, document units, body names, per-body readiness, and
the all-or-nothing rule before execution. Blocked bodies remain visible so the
user can remove them and explicitly re-plan a supported subset.

The existing identity-bound executor reports artifact and writer progress while
retaining all source-currentness, artifact validation, aggregate limits, and
direct bytes-to-Blob download cleanup. Cancel uses the existing geometry
scheduler generation boundary; Retry resumes that scheduler and re-queries the
same selection instead of replaying a stale plan. Source edits, approved agent
edits, undo/redo, and project replacement therefore stale or cancel in-flight
work before download.

The chooser and actions are keyboard operable. Escape cancels running export,
progress and terminal results use live regions, human-readable failure text is
shown before technical codes, and focus returns to the STEP action group after
download, cancellation, or execution failure. The existing responsive Project
layout stacks the chooser and actions without hiding blockers.

The agent adapter accepts one optional session-local reader for bounded current
exact metadata and result-status evidence. The connected browser supplies the
same projection used by Project/Export, while the ordinary in-memory adapter
continues to report pending without a worker. Query and V8 surface responses
contain complete ordered plan/readiness metadata but strip artifacts and expose
no bytes, handles, paths, job/cache IDs, private geometry IDs, download action,
or file-writing authority. MCP tool descriptions and schemas state the
read-only AP242/order/all-or-nothing boundary.

V20 remains unchanged: exactly `manualApproval` and `approveAll`, read-only
export planning creates no proposal, relay methods and authentication are
unchanged, and no transport, permission, network, script, filesystem,
dependency, package, schema, `.wcad` version, or CAD capability row was added.

## Checks

- Browser workflow, lifecycle, accessibility markup, progress, cancellation,
  Retry, download cleanup, and approved-agent staleness: 38 tests passed across
  3 web files.
- Agent adapter exact/readiness and file-authority boundary: 86 tests passed.
- MCP tool schema and response boundary: 74 tests passed.
- V20 loopback token/origin/host/single-tab and four-operation relay security:
  5 tests passed.
- Production V20 live-agent browser workflow passed after a production web
  build and stdio-server build, including both approval modes, query/dry-run,
  staleness, viewport rebuild, and WCAD round trip.
- Agent-adapter, web, and MCP-adapter typechecks passed.
- `git diff --check` passed.

Gate H is complete. Slice I may add only the approved release corpus, named
commands, browser round trips, performance/bundle evidence, adversarial review,
and final release records.
