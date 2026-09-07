# Agent runtime verification

Release goal: [agent runtime](./agent-runtime.md). Usage:
[build, launch, and model](./agent-runtime-usage.md).

Recorded September 7, 2026 on macOS, Node 22.22.1, pnpm 10.14.0,
Bun 1.4.2, and Chrome 152. Results are local; GitHub Actions remains disabled.

## Integration checks

| Check | Result |
| --- | --- |
| `pnpm verify` | All workspace typechecks; 26/26 command scenarios |
| `pnpm --filter @web-cad/web build` | Production app and worker bundles built |
| `pnpm smoke:agent-runtime` | 2/2 complete MCP/native/STEP journeys |
| `pnpm smoke:ui -- scenarios/agent-runtime-source-revision.json scenarios/v25-feature-pattern-fillet.json scenarios/v26-distance-mate.json` | 3/3 Chromium engine scenarios |
| New native-file Use journey plus all five existing Use journeys | 6/6 Chromium success/break cases |
| MCP adapter / stdio focused tests | 88 / 17 passed |
| Core source revision / exact export readiness tests | 16 / 2 passed |
| Final project health and hole-retarget regressions | 7 passed |
| Shared runtime / geometry artifact tests | 2 real OCCT runtime tests; 7 focused geometry tests passed |
| Final browser preflight, scheduling, preview, and status regressions | 94 passed |
| Numeric input and Project workspace / assembly query regression | 16 / 1 passed |
| Final tool schema validation | All 53 tool schemas compile; all 31 example operations validate |

Run the standalone native-file Use journey with
`pnpm smoke:agent-runtime:browser` after the headless closer. Run the five existing
journeys with `pnpm smoke:ui-use`. Their combined invocation passes all six file
arguments to that same runner. The new command-truth scenario is
`scenarios/agent-runtime-source-revision.json`; its separate native-file Use
fixture is `examples/agent-runtime/browser-use.json`.

Repository-wide `pnpm lint` reports 12 existing errors across seven files.
All 12 were independently reproduced from the starting commit
`e8a8ed2d09fa1cac6fede01d28d4125320f64a2a` using ESLint stdin with each original
file's path. The baseline includes React ref/effect rules, a NaN comparison, and
two unused variables in assembly helpers. It was not caused by this change or
a dependency upgrade. Evidence is in `.metrics/agent-runtime/lint-baseline.json`.
Changed-file lint introduces no new errors; existing warnings remain.

## Two end-to-end designs

`pnpm smoke:agent-runtime` builds the CLI and runs both checked-in examples
through real MCP stdio processes. It checks exact OCCT volume and bounds,
rejected edits and dry runs preserving source identity, revision, native save,
fresh-process reopen, and STEP readback through OCCT. STEP readback checks
solid count and total volume, not merely file headers or export metadata.
Public project health must contain no blocking issues after creation, revision,
and reopen; under-defined sketch notes are permitted.

| Design | Revision | Exact volume before → after (mm³) |
| --- | --- | --- |
| Filleted mounting plate with two holes | Thickness 4 → 6; hole radius 2 → 2.5 | 3734.318591 → 5519.230107 |
| Open enclosure and fitted lid | Case height 20 → 24; lid mate distance 20 → 24 | Case 11712 → 13248; lid 7769.04 unchanged |

The mounting plate's rejected fillet edit is a supported-policy rejection:
its result has a downstream consumer. The enclosure's excessive shell wall
is an actual OCCT geometry rejection. Both preserve the authoritative project.
Native reopen preserves the enclosure's two instances, mate, and lid pose.
STEP exports the two part definitions, not the assembly mate system.

Fixture sources live in `examples/agent-runtime/`. Generated `.wcad`, `.step`,
and `verification.json` artifacts live in `.metrics/agent-runtime/` and are
gitignored.

## Browser compatibility

`pnpm smoke:agent-runtime:browser` opens the headless-produced `.wcad` through
the real workbench Open handler and edits hole radius 2.5 → 3 through the
Parameters form. Exact volume must change from 5519.230107 to 5415.557549 mm³;
the test cannot pass with the previous geometry still displayed. Its break case clears the numeric input and asserts that Apply
is disabled and the committed value remains 2.5. The runner supplies a fixture
file handle in place of the operating-system picker; picker interaction itself
is outside this check. Import, source replacement, geometry rebuild, button
clicks, and numeric typing use the real app.

The existing Bun/Chrome runner is reused. Journeys use fresh tabs, observable
state assertions, and no retries or screenshot pixel comparisons. Success and
break screenshots are written under `.metrics/ui-smoke/`.

## Defects exposed during development

- Deep source extrusion revisions were blocked after a second downstream
  consumer. Supported chains now rebuild with accurate affected IDs and retained
  consumed-body state. Proposed source changes are validated before commit;
  incompatible replacement profiles preserve source and history.
- Exact STEP readiness rejected valid rectangle/circle additive and subtractive
  extrusion results despite current exact evidence. Readiness now accepts those
  results while retaining stale/missing evidence checks.
- Agent project structure omitted assembly instances and solved poses. The
  adapter now forwards the core assembly snapshot.
- Project health used an obsolete hole-target rule and marked valid holes on
  filleted bodies as unsupported. It now uses the command source-eligibility
  policy, retaining rejection of missing, cyclic, and ineligible targets.
- Numeric inputs inherited HTML's step of 1, which prevented changing a saved
  value of 2.5 to 3. The default is now `step="any"`; explicit increments remain
  supported.
- Browser source extrusion commits needed the same downstream exact preflight
  as headless. Reused artifacts from an older source revision now trigger a
  rebuild instead of a stale-artifact failure.
- Normal browser edits reused the cancellation generation as a document
  revision, so the scheduler rejected valid rebuilds as superseded. Artifact
  jobs now use the source-authority epoch and keep their scheduling keys
  separate from metadata jobs and preview drafts. A real scheduler regression
  covers edit, undo, redo, and native reopen.
- The smoke client's shutdown could hang if its child process failed to spawn.
  It now handles process closure and pipe errors, rejects calls after shutdown,
  and was checked against an actual missing-executable failure.

Focused regressions accompany command, runtime, geometry, file-host, and adapter
changes. The new browser journey covers the numeric-input failure through the
actual form.

## Actual agent exercise

An informed developer agent received a separate circular-flange brief and used
the real MCP executable to create and revise it, inspect exact geometry, save,
reopen in a fresh process, and export STEP. It built the flange in one 16-op
batch and revised diameter and thickness in one two-op batch. Measured volume
changed from 4696.681017 to 7068.583471 mm³, matching analytical expectations;
the final STEP file was 24,396 bytes.

The exercise used 17 tool calls, 21 protocol requests, 213,942 response bytes,
and 6.256 seconds of cumulative tool latency. Active manual work took 193.8
seconds, with a separate 328.5-second wait for a rebuild. One revision attempt
failed before the source-chain fix. These are development observations, not a
blinded usability study or an OpenSCAD comparison.

The first trial required a public TypeScript lookup because modeling operation
schemas were incomplete. The final published schemas explicitly describe all
nine operation kinds it used, and both complete flange batches subsequently
validated against those schemas. This follow-up does not retroactively make
the original trial schema-only. Reports, transcript, replay, and schema checks
are under `.metrics/agent-runtime/agent-trial/`.

## Remaining boundaries

Existing feature-composition restrictions remain; Combine does not accept every
finished feature family. Some consumed finishing-feature edits remain blocked.
Native files preserve assemblies; STEP exports part definitions. Headless has
no viewport picking or browser file dialogs. No modeling family, native format
version, external dependency version, or GitHub CI workflow was added.

## Performance observations

`pnpm benchmark:cad-runtime` passed three fresh-process runs per design on an
Apple M4. These are source-runtime measurements with the workspace TypeScript
loader. They are separate from the bundled MCP calls above.

| Median | Mounting plate | Enclosure and lid |
| --- | ---: | ---: |
| Process start to first exact model | 3250.38 ms | 3183.76 ms |
| TypeScript import, included above | 1349.34 ms | 1339.83 ms |
| Initial batch, including first OCCT load | 1896.51 ms | 1831.28 ms |
| Warm revision | 97.36 ms | 64.83 ms |
| Exact inspection immediately after revision | 1.74 ms | 2.95 ms |
| STEP bytes ready | 47.14 ms | 71.31 ms |
| WCAD bytes ready | 30.12 ms | 28.18 ms |

Warm revisions ranged from 97.35–98.06 ms and 63.49–65.85 ms respectively.
The enclosure revision rebuilt two artifacts and reused its unchanged lid.
Repeated exact inspection of an unchanged session built nothing. Export and
serialization figures end at bytes ready, excluding MCP and filesystem work.

A separate paired experiment alternated displayed and exact-only primitive
artifact creation, discarded two warm-up pairs, and measured seven pairs.
Box medians were 16.50 → 13.63 ms (17.4% lower); cylinder medians were
23.81 → 19.34 ms (18.8% lower). BRep bytes, metadata, and topology matched.
This measures the benefit of omitting unnecessary display work for those
primitives, not an equivalent percentage improvement for entire workflows.

Full samples, environment, invariants, and cache/build counters are in
`.metrics/agent-runtime/benchmark.json`. Three samples are descriptive evidence,
not a latency guarantee or p95 estimate. Browser latency, large-model scaling,
and OpenSCAD comparisons were not measured. Cold OCCT loading remains a larger
cost than warm revision in these examples.
