# Robot arm workflow fixes

Status: complete. User goal: “fix them correctly,” September 7, 2026.
Baseline: `de7fd976`. Evidence: [robot arm trial](./robot-arm-trial.md).

An agent can build the recorded robot-arm parts on their intended standard
planes, discover profiles through the public headless interface, and receive
accurate, atomic failure diagnostics. It can assemble a connected arm, revise
link length and joint angle while retaining pivot attachments, bind the gripper
opening to its mates, and save/reopen the result. The browser presents the posed
assembly clearly and exposes the same supported edits through CADOps.

## Scope

- Correct the XZ exact placement, async region queries, and failure attribution.
- Extend the existing assembly CADOps/types where necessary for direct instance
  pose updates, connected constraint propagation, controlled angular joints,
  geometry-linked pivot references, and parameter-bound mate values. Preserve
  existing document/native versions and backward compatibility; use public
  authored identities, never raw OCCT IDs.
- Document complete transform and command contracts in public usage/schema
  surfaces. Keep MCP a pass-through over the existing command/query layer.
- Provide an assembly-focused view and ordinary workbench edits for the new
  supported assembly operations.
- Preserve the diagnostic trial as historical evidence. Add a revised arm
  example and focused checks demonstrating the improved workflow.

No new modeling family outside assembly, workspace package, production
dependency, native format version, new MCP tool, collision solver, dynamics,
manufacturing claim, or assembled STEP hierarchy is required. STEP definition
export already passed; it remains a checked handoff rather than a new feature.

## Implemented behavior

The revised [robot arm example](../examples/robot-arm-workflow/README.md)
contains 11 exact definitions and 29 connected instances, with one fixed root
and 28 `revolute` mates. These include controlled arm joints, constant-angle
hardware mounts, and jaw relations with parameter-bound axial offsets.

One three-operation batch updates upper-arm pivot spacing 160 → 180 mm,
gripper clearance 20 → 35 mm, and shoulder angle 60° → 75°. Instance and mate
identities remain stable. The original trial needed 89 operations for length
and opening changes because it reconstructed the instances and mates; the new
operation count also includes a joint-angle change. This is an authoring
improvement, not a competitive timing claim.

| Area | Implemented contract |
| --- | --- |
| Geometry | Standard-plane exact construction uses consistent frames; XZ authored geometry retains its intended plane and normal. Tests inspect centroids and holes as well as volume. |
| Profile discovery | Region candidates, region validation and curve readiness dispatch through synchronous and asynchronous hosts; only malformed inputs become `INVALID_ARGUMENTS`. |
| Failure diagnostics | Exact failures identify the failing body/source operation when established. Assembly errors retain a proven mate operation, including generated IDs; unknown origin does not become a guessed final-operation index. Rejected batches preserve the source. |
| Connected poses | `assembly.instance.updateTransform` edits a free instance or grounded root. Retained descendants follow; constrained children are edited through their mates. Delete/reinsert operations retain their explicitly authored pose. |
| Joint frames | Revolute mates reference complete local frames or authored sketch circle/point frames. Source-linked frames follow evaluated sketch dimensions, including ancestry through feature patterns. |
| Parameter bindings | Distance, angle and axial offset fields accept numeric literals or parameter IDs. The jaws use evaluated offset expressions derived from the opening parameter. |
| Discovery | Existing `cad.batch` schemas describe all assembly operations and mate kinds. `cad.project_structure` exposes instances, resolved transforms and mates without a full native handoff. |
| Workbench | Assembly/Parts view separates posed occurrences from source definitions. Joint and free/root pose controls submit the existing CADOps; the focused joint/pose Use journey passed. Full-arm native Open, joint edit, Undo/Redo and parameter revision pass in Chromium. |

The [public usage guide](./agent-runtime-usage.md#connected-assemblies) is the
field-level reference. Transform rotation is in radians, applied X then Y then
Z; scale precedes rotation and translation follows it. Revolute angles use
degrees. Lengths and offsets use document units. Existing mate-plane normals
remain XY → +Z, XZ → +Y, YZ → +X; authored XZ sketch frames use the right-handed
U=+X, V=+Z, normal=−Y convention.

## Boundaries

The supported graph is a rooted forest, including compatible parallel
constraints between the same pair. General closed loops, dynamics, collision
checking and manufacturing validation are outside this goal. Revolute-connected
instances require unit scale; source dimensions control part size. Geometry
references use authored public IDs, not derived OCCT identities.

Native `.wcad` retains source connections, parameters, instances and mates in
the existing format. STEP exports the eleven selected part definitions, not
29 assembled occurrences or an assembly hierarchy. No new MCP tool, package,
production dependency or native format version was introduced.

## Proof requirements

Use focused tests for the three defects, assembly edits/propagation, validation,
undo/redo, semantic diffs, and native persistence. Include conflict and invalid
reference cases that reject atomically instead of silently breaking attachments.
Run touched-package typechecks, relevant CADOps scenarios, the named robot-arm
closer, and the existing two assembly E2E journeys. Use the existing Bun/Chromium
runner for new UI success/break paths and engine proof; no new browser bot or
historical gauntlets. Native reopen and exact/STEP checks must exercise the
revised arm, including length and angular edits without deleting instances.

Record implementation decisions, verification results, limitations, and the
landed commit here before closing. GitHub Actions stays disabled.

## Verification record

Run the headless closer first, then its browser counterpart:

```sh
pnpm smoke:robot-arm
pnpm smoke:robot-arm:browser
pnpm smoke:e2e
pnpm smoke:ui -- scenarios/robot-arm-revision.json
node scripts/scenarios-run.mjs scenarios/robot-arm-revision.json
```

The headless closer passed on September 7, 2026 (UTC report timestamp
`2026-09-08T02:23:40.737Z`). The report is
`.metrics/robot-arm-workflow/verification.json`; native and STEP artifacts are
`robot-arm-initial.wcad`, `robot-arm.wcad`, and `robot-arm-definitions.step`
in the same directory. It exercises real MCP processes, all eleven exact
volumes and centroids, both intended-plane solid authoring paths, profile
discovery, pivot alignment and actual jaw clearance, dry-run preservation,
three-operation revision, invalid-reference rollback with correct operation
index, root motion, fresh-process reopen and further editing. Independent OCCT
STEP readback verifies eleven solids with matching total volume.

The two new browser journeys and both existing assembly regressions passed
without scenario retries on Bun 1.4.2 / macOS Chrome 152:

| Journey | Observed time | Assertions |
| --- | --- | --- |
| Full native robot arm | 45.1 s | Open headless WCAD, exactly 29 posed meshes, Assembly/Parts toggle, shoulder 75°→90°, Undo/Redo, span 180→200 mm, changed exact volume and connected pivots, empty angle blocked. |
| Joint/root controls | 5.9 s | Create parameter-bound sketch-pivot joint; translate root X 5 and rotate Z 90°; child follows, free instance stays; Undo/Redo; blank pose blocked. |
| Concentric/cancel | 5.5 s | Existing radial alignment, Cancel and empty collector regression. |
| Distance/history | 5.6 s | Existing gap, Undo/Redo and empty distance regression. |

Times describe one observed run, not assertions or a competitive benchmark.
The full-arm journey opens a fresh tab for its break case. The OS file-picker
result is supplied by the existing fixture helper; native parsing, rebuild,
editing and rendering run through the real workbench. Success and break
screenshots are under `.metrics/ui-smoke/`; the full-arm success is
`robot-arm-connected-revision.png`. The recorded paths are
[the native fixture](../examples/robot-arm-workflow/browser-use.json) and
[the command/control scenario](../scenarios/robot-arm-revision.json).

Browser verification exposed and fixed additional defects: native history
comparison rejected harmless cross-runtime trigonometric rounding; selected-file
errors reopened an unrelated upload dialog; and readiness counted runtime and
artifact records for the same body twice. Native replay now tolerates only tiny
solver-derived pose differences, keeps authored values exact, validates final
assembly content, and preserves saved source authority. The native-open flow
reports the actual failure without losing the previous document. Readiness
counts unique source identities; the runner requires every active exact body
and every display entry to be ready.

Focused verification covers geometry centroids/holes across standard planes,
async queries, exact failure attribution, connected assembly propagation,
invalid references and conflicts, bindings, undo/redo and native persistence.
Independent review added regressions for pattern-source pivots, generated mate
IDs and delete/reinsert transport. Cross-runtime native tests exercise partial
pose edits, detached instances, redo history, further revision and resave, and
reject altered authored fields and substantive derived-pose changes.

All eight touched packages passed typecheck. Scoped new/changed-code lint passes
apart from four independently reproduced baseline errors in SolidModePanel and
solidDraftValidation; no clean whole-repository lint claim is made. GitHub
Actions remains disabled. The two existing fast assembly journeys remain the
`smoke:e2e` default; the fuller robot-arm test is a separate closer.

The original diagnostic `robot-arm-final.wcad` also reopens with all 29
instances and 29 mates. Replay accepts proven redundant legacy mate updates
and identical duplicate assembly summaries, and compares final mate identity
and content independently of old edit-induced ordering. Tests reject tampered
no-op rows, poses and metadata; saved history/document values remain intact.

Final core checks pass: 27 focused assembly tests, seven command scenarios,
core typecheck and scoped lint. The Chrome engine scenario passes in 2.0 s.
Final Chromium acceptance passed 4/4 without retries after the compatibility
fix. Logs: `.metrics/robot-arm-workflow/browser-final.log`,
`browser-engine-final.log`, `headless-final.log`, `core-final.log`,
`scenarios-final.log`, and `typecheck-final.log`.

Implementation commit: `6c48613f` — `fix: make robot arm revisions connected and portable`.
