# V18 Display-Geometry Reliability Repair Plan

## Decision and scope

Treat the Terra evaluation failure as a reliability investigation, not a proven
deterministic Partbench freeze. The same production Cylinder completed in an
isolated Chromium run, while concurrent cold Chromium/OCCT processes ran on a
3.7 GiB, no-swap host with historical OOM kills. This strongly implicates
resource exhaustion, but does not prove it: OOM data was not captured as per-run
deltas and summed RSS overcounts some shared memory.

The repair stays within V18 maintenance. It may improve browser loading,
scheduling, status, failure recovery, tests, and evaluation infrastructure. It
must not add CAD commands, change geometry quality, weaken a V17 workflow,
introduce silent fallbacks, or expand the OCCT/WASM contract. If an acceptable
memory budget requires a minimal OCCT build, stop and propose a later milestone.

## Measurement terms

- **Cold host:** dedicated fresh VM/runner with no prior Partbench processes and
  no concurrent heavyweight browser job.
- **Fresh process / worker:** new browser and geometry worker on an already
  booted host. This is not a cold-host run.
- **Warm cycle:** another operation in the same healthy browser and worker after
  OCCT has loaded.
- **Current revision:** exact commit, browser, runner image, memory limit, and
  test data recorded with every result.
- **Supported resource envelope:** the declared minimum memory/headroom and
  maximum supported browser concurrency for which product reliability is
  claimed. It is chosen before interpreting baseline results.

## 1. Establish the baseline before changing runtime behavior

Add a production-build browser smoke for geometry startup. Serve one immutable
build from one static server. Run Box-first and the reported Radius 40 mm ×
Height 10 mm Cylinder-first cold samples in separate fresh browser/worker
processes and report their distributions independently. Only later operations
in the same worker count as warm. Heavyweight browser jobs on this host must
share an always-on semaphore.

The harness must:

1. Run each browser job in a dedicated child cgroup/container when the runner
   supports it. Record host `MemAvailable`, cgroup current/limit/peak, and
   `memory.events.local` deltas. Otherwise correlate any OOM victim PID from
   kernel/cgroup evidence with the browser process set and treat an uncorrelated
   delta as pressure, not browser causality. Compute usable memory as the
   smaller of host availability and cgroup headroom, retain a fixed reserve,
   and admit concurrency using a frozen upper bound on per-browser incremental
   cgroup peak—at least observed maximum plus a declared margin or an upper
   confidence bound—not p95 PSS/RSS. Recheck continuously. An unsafe preflight,
   headroom abort, or resource skip is **NOT RUN**, never a product failure or
   pass.
2. Use one CDP session identifier per target and recursively auto-attach to page
   and dedicated workers. Enable Runtime and Log for each; preserve page
   exception/crash, worker exception/detach/crash, and protocol-disconnect
   outcomes separately.
3. Emit diagnostic performance events for command committed; display queued,
   worker started, settled, and mesh published; exact queued, started, and
   settled; watchdog; and retry. Include source ID, revision/cache key,
   operation class/outcome, and queue/execution/response time.
4. Sample memory after display and exact settle and after five idle seconds,
   without forced GC. Prefer cgroup-private accounting or PSS/private memory
   from `smaps_rollup`; do not accept summed process-tree RSS.
5. Run at least 3 cold-host, 20 fresh-process/worker, and 30 warm samples. Report
   count, median, p95, and maximum rather than one duration.

Before runtime implementation, declare the supported resource envelope and
freeze current-revision distributions and numeric budgets: a simple-Cylinder
display SLO (30 seconds or tighter), exact SLO, peak private/PSS, five-second
quiescent memory, and allowed warm-cycle slope. Baseline data informs but cannot
define the resource envelope. If its upper bound exceeds the envelope, the work
may claim safer evaluation and recovery, not that product memory use is solved.
Preserve raw results as CI artifacts.

Audit the production bundle with the Rollup graph, emitted assets, browser
network trace, and long tasks. The page dynamically imports request builders
from the browser geometry-worker entry, but do not assume an import-only fix is
safe: that package value-imports kernel code. Change imports only if evidence
proves browser kernel/OCCT code leaves the page without moving into another
eager chunk, and retain it only when metrics improve without regression. Add no
package or dependency.

## 2. Make shared-worker scheduling explicit

Put an app-local scheduler above the shared dedicated-worker transport. Every
production kernel call—display, exact metadata, command preflight, STEP
import/export, and checkpoint—must enter it. Call sites explicitly declare
intent; the scheduler never infers priority/coalescing from an operation name.
Audit direct runtime/kernel construction and remove the current page-side STEP
export worker path. Prove by bundle/network assertion that export no longer
loads or executes browser-kernel code on the page thread.

Use a discriminated job union:

- Supersedable `display`/`exact` jobs require source ID, document revision,
  cache key, operation, and run ID.
- Non-supersedable `user` jobs (preflight, import/export, checkpoint) require a
  unique job ID, operation, and run ID and never enter source-key coalescing.

Every call belongs to one explicit class:

1. Non-supersedable user work: command preflights, STEP import/export, and
   checkpoints.
2. Visible display geometry.
3. Background exact metadata.

Only one kernel operation executes at once. After the current operation, run
user work, then display, then exact; use FIFO within a class. After four display
operations, give the oldest exact request the next slot if no user work waits.

Coalesce only by `{intent, sourceId}` and supersede only an older revision of
that same derived intent. A current source may require one display and one exact
job; neither may remove the other. Never coalesce or automatically replay user
work. An obsolete in-flight derived request may finish, but
generation/cache-key checks discard it. The latest request runs once,
superseded queued work runs zero times, and at most one obsolete request is in
flight. Guard lazy worker creation/disposal against StrictMode cleanup races
and abandoned publications.

## 3. Detect and recover from worker failure truthfully

Keep the Cylinder acceptance SLO separate from recovery timeouts. Add an
app-local worker-entry acknowledgement so queue, startup/transport, synchronous
kernel execution, and response transport are timed separately. Automatically
terminating watchdogs may cover only bounded startup/transport/response states
and fatal worker events. Because V17 does not bound supported workload sizes and
OCCT is synchronous, elapsed time after valid kernel entry is diagnostic unless
an existing documented support-matrix bound proves a safe maximum. Otherwise a
long operation requires explicit user cancellation/restart, not fixture-derived
automatic termination.

Calibrate bounded timeouts from a statistically adequate sample for each state,
or from the observed maximum plus a declared conservative safety factor; do not
label a 20-sample maximum as p99. Test just-below/just-over boundaries with
injected delayed acknowledgements. Representative real Box, Cylinder, Loft,
Sweep, pattern, exact, STEP, checkpoint, and preflight cases prove only that
valid V17 work remains below each bounded phase timeout.

A bounded timeout, explicit cancellation, or fatal worker event performs one
atomic generation rollover:

1. Increment generation and terminate the worker once.
2. Reject in-flight work and drain/reject all old-generation queued work.
3. Mark affected derived results failed/cancelled; preserve unrelated ready
   results.
4. Prevent late old-generation publication.
5. Wait for explicit retry; never automatically replay.

While any worker job is executing—including synchronous kernel execution—the
progress surface exposes **Cancel model work**. It performs the same rollover,
ends in a truthful cancelled state, and never reconciles automatically. Repeated
clicks are idempotent. If derived results now need reconciliation, expose
**Retry model results**; one action creates one worker generation and reconciles
only current cancelled/failed display and exact results. Disable or merge
repeated retries while active. If a preflight, STEP operation, or checkpoint was
cancelled, identify it and require the user to invoke that original action
again. Never replay it. The shell remains usable throughout, and no stale or
fallback result is published.

Display-ready/exact-failed and display-failed/exact-ready are partial states,
not overall `Ready`; identify the failed result while keeping unaffected
document controls usable.

## 4. Experiment with staging exact metadata

The app currently reconciles display and exact together. Test this matrix after
scheduling becomes observable:

| Source state | Required behavior |
| --- | --- |
| Matching authored display pending | Start exact after display settles |
| Matching display cached | Start exact immediately |
| Imported/checkpoint-only; no display derivation | Run exact independently |
| Display unsupported; exact supported | Run exact separately; never claim display ready |
| Conclusively classified authored recipe/B-rep rebuild failure | Block matching exact, clear prior current exact evidence, and keep Project health, mass properties, topology, and STEP non-Ready for that revision |
| Conclusively classified display-only tessellation/mesh failure after valid same-revision B-rep construction | Run exact independently; exact may become Ready but never makes display Ready |
| Ambiguous worker-healthy `KERNEL_FAILURE` | Run exact independently; exact failure leaves both outcomes failed/cleared, while exact success yields truthful display-failed/exact-ready |
| Transport failure/watchdog | Fail/cancel both affected classes; explicit retry |

Classify stages only from structured existing response evidence, never error
message matching; an unproven stage is ambiguous. Imported/no-display sources
remain the explicit exception to authored-result coupling. Retain staging only
if, on the same build and runner profile,
end-to-end commit-to-display-ready p95 improves by at least 15% **or** peak
private/PSS by at least 10%, commit-to-exact-ready p95 regresses no more than
10%, and all exact capabilities complete. Otherwise revert staging and keep
independently proven scheduling/recovery changes.

Implementation review exposed a narrower correctness requirement inside this
experiment: after a fatal display failure, retrying authored display and exact
work together can let exact enter the worker while display is still performing
its asynchronous cache lookup. The implemented retry path therefore defers a
retryable authored exact result until its matching display result settles;
imported exact work remains independent. The initial authored cold path uses
the same ordering so the retry invariant cannot be bypassed. This minimal
per-source dependency is retained as correctness hardening, not as evidence
that the quantitative staging experiment passed. The ≥15% display/≥10% memory
gate still governs any broader staging or optimization claim.

## Implementation verification status (2026-07-22)

The scheduler, stale/delete invalidation, production diagnostic events,
cancel/retry UI, operation-specific export boundary, final cgroup
classification, recursive worker instrumentation, and awaited browser cleanup
are implemented. The uncalibrated automatic worker-entry kill threshold is not
enabled in production; explicit cancellation and fatal transport/worker
responses still roll the entire worker generation atomically.

The production headless Cylinder smoke passed using the host's Playwright
Chromium and the frozen default 256 MiB reserve. Its artifact recorded visible pending,
display, and exact phases; warm tree/search/Fit-all actions; page and worker
diagnostics; about 836 MiB incremental cgroup memory peak; and no new OOM
events. A final post-review rerun passed with about 8.7-second display and
8.9-second exact visibility after commit, a 246 ms largest heartbeat gap,
about 766 MiB incremental cgroup memory peak, and zero OOM-event delta. An
earlier low-headroom attempt truthfully returned `NOT RUN` before launch. All
six named V17 workflows also passed after the legacy browser driver was updated
for the completed V18 action labels and document-tree selection control. The
headed, Box, three-cold, 20-fresh, 30-warm, private/PSS,
long-task/frame, and three-agent matrices remain unverified and must not be
described as passing.

## 5. Regression coverage

Add coverage for:

- priority, FIFO, four-display fairness, queue/execution timing, and exact work
  under sustained display edits;
- coalescing by intent/source so display and exact never supersede each other;
- counts/coalescing during rapid edit, delete, new document, unmount, and
  StrictMode remount;
- direct preflight, import, export, and checkpoint callers all entering the
  scheduled dedicated worker with explicit user intent and priority, never
  source-coalescing or automatically replaying;
- every staging-matrix row, including conclusively classified B-rep failure,
  conclusively display-only failure, ambiguous `KERNEL_FAILURE`, unsupported,
  and partial states;
- generation rollover, one termination, full drain, stale rejection, and
  unrelated ready-result preservation;
- cancellation during display, exact, preflight, STEP, and checkpoint work;
  injected never-settling-after-entry recovery; idempotent repeated cancellation;
  and the shell exiting pending without stale/fallback output;
- one explicit derived retry creating one worker/reconciliation and repeated
  clicks merging while it is active;
- timed-out user import/export/checkpoint work never replaying;
- STEP export not blocking the main thread and rejecting, not replaying, on
  generation failure;
- truthful pending/failed/partial UI with no stale or fallback mesh;
- a failed authored B-rep revision clearing old exact evidence and never
  reporting Project health, mass properties, topology, or STEP as Ready, while
  a classified display-only tessellation failure can retain independent exact
  readiness without claiming display readiness;
- unchanged V17 behavior and command semantic diffs.

Strengthen the production browser smoke so primitive checks await both derived
outcomes rather than only a tree row. Exercise tree, search, Fit all, and a
lightweight shell action while work is pending and after it settles.

## Acceptance gates

- Isolated runs have no page/worker crash, detach, uncaught runtime error,
  disconnect, or new per-run OOM-event delta.
- Simple Cylinder meets the frozen 30-second-or-tighter display SLO; exact meets
  its separate SLO. Neither is inferred from the watchdog.
- Pending appears by the next animation frame. Main-thread heartbeat gaps stay
  below 1 second, frame p95 ≤34 ms, no main-thread task exceeds 50 ms during
  kernel work, and warm shell-action p95 is ≤100 ms.
- Tree, search, and Fit all remain usable while pending and ready.
- Peak private/PSS and idle memory meet frozen numeric budgets within the
  declared supported resource envelope. Before comparison, the artifact names
  the memory-slope estimator, confidence/upper-bound rule, warmup points, sample
  points, and numeric allowed slope. A leak check alone does not replace the
  peak budget.
- Scheduling, fairness, counts, generation, stale-result, and explicit recovery
  assertions pass.
- A never-settling post-entry job can be cancelled once from the UI; the shell
  stays usable, the pending state ends truthfully, and derived retry versus
  user-action reinvocation follows the rules above.
- Import cleanup is proven by before/after artifacts or not made. Staging meets
  its gate or is reverted.
- Identical instrumentation passes headless and one named headed Chromium job.
  Run the original three-agent scenario concurrently (`N=3`) on a dedicated,
  adequately provisioned host. Claim that resource exhaustion caused the old
  failures only if a controlled constrained-memory run also reproduces them
  with browser-attributed OOM evidence; otherwise keep the diagnosis “likely.”
  A resource skip makes no reliability claim.
- Build, tests, typecheck, lint, and format pass with V18 gates, strengthened
  browser smoke, and all six named V17 workflows in `docs/v17.md`.

## Adversarial verification after implementation

Run three independent reviewers with narrow briefs and no implementation
coaching:

1. **Causality:** try to disprove the resource diagnosis using raw timing,
   private/PSS, cgroup-delta, crash, and cold/warm artifacts.
2. **Lifecycle:** attack edits, deletes, navigation, StrictMode, timeouts, late
   messages, partial failures, repeated retries, and starvation.
3. **Architecture:** check command authority, boundaries, V17/V18 scope,
   geometry fidelity, and absence of fallback or new CAD capability.

Serialize heavyweight browser work on this host. Every blocker must name a
reproduction and violated gate; fix and rerun that review before completion.

## Implementation order

1. Land harness, telemetry, admission, and baseline artifacts; freeze budgets.
2. Make only an evidence-supported bundle/import change and remeasure.
3. Add scheduler/lifecycle tests, then integrate every worker operation.
4. Add bounded-phase timeouts, diagnostic execution timing, atomic recovery,
   partial state, cancellation, and explicit retry.
5. Run the staging experiment and retain/revert it by its quantitative gate.
6. Run the full release matrix and three adversarial implementation reviews.
