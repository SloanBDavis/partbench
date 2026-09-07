# Robot arm agent trial

Status: complete. User-requested diagnostic experiment, September 7, 2026.
Baseline: `d6498191` (completed agent runtime release).

The independent designer built an exact static robot-arm concept with movable
gripper jaws: 11 part definitions, 29 instances, and 29 mates. It could not
produce a functioning angular articulated chain. It recovered from geometry
failures by moving every definition to XY, needed two narrow source lookups,
and used 89 operations to revise the arm length and opening while preserving
the pose. These workarounds are part of the finding, not evidence that the
original workflow is complete.

Product code stayed at the baseline throughout. The defects below remain open.
This delivery contains the observed findings and reproducible authored inputs,
not a new product release or a claim of superiority to another CAD tool.

## Result and next work

| Requirement | Outcome |
| --- | --- |
| Useful parts and reused hardware | 11 exact definitions, 29 instances; verified bored solids |
| Clearly bent arm | Static pose: yaw 25°, shoulder 60°, elbow −100° relative, wrist +40° relative |
| Functional articulated chain | Blocked; fallback fixes 23 instances, with four concentric pins and two distance-mated fingers |
| Upper span 160 → 180 mm; opening 20 → 35 mm | Achieved with externally recomputed transforms and full instance/mate reconstruction |
| Actual supported motion | Jaw distance-mate edits move opening 35 → 25 → 35 mm |
| Fresh native reopen | Source identity, exact geometry, instances, mates, and poses preserved |
| STEP handoff | Eleven part definitions exported and read back; no assembled STEP product |

Recommended order for subsequent product work:

1. Fix the three confirmed contract defects first: XZ geometry placement,
   asynchronous region queries, and exact-failure operation attribution. Keep
   the probes small: equivalent XY/XZ/YZ geometry with centroid and hole checks,
   the same query through synchronous and asynchronous hosts, and a failure
   before the final batch operation with atomic rollback.
2. Make this arm a connected, editable assembly. The useful acceptance target
   is a link-length edit and a joint-angle edit that retain pivot attachment
   through native reopen, without deleting and rebuilding the assembly. This
   needs connected constraint propagation, angular joint control, references
   that follow geometry, and a direct pose-edit contract. Parameter binding to
   mate values would also remove the informational gripper parameter workaround.
3. Make the supported path discoverable and readable: document transform
   frames/units/order, expose complete operation schemas and bounded assembly
   queries, and provide an assembly-focused browser view. Treat assembled STEP
   export as a separate handoff requirement; definition export did succeed.

The next useful goal is reliable connected assembly revision. These are
recommendations from this trial, not authorization to implement every item.
In this run, tool execution was a small part of the elapsed effort; capability,
debugging, and authoring friction dominated. One trial cannot establish general
performance or a competitive benchmark.

See the [designer journal and replay instructions](../examples/robot-arm-trial/README.md).
Final native: `.metrics/robot-arm-trial/robot-arm-final.wcad`.
Browser screenshot: `.metrics/ui-smoke/robot-arm-trial-final.png`.

## Design brief

Build a tabletop robot arm with base yaw, shoulder, elbow, and wrist joints,
plus a simple two-finger gripper. Aim for 8–12 distinct useful part definitions
with reused pin or fastener instances. Use a mounting base, yaw/shoulder
structure, an upper arm with 160 mm pivot spacing, a 140 mm forearm, a wrist,
and gripper fingers. Roughly 8 mm pivots, 4.5 mm mounting bores, and reasonable
plate clearances make the geometry concrete without prescribing a recipe.

Keep principal dimensions editable. Assemble a clearly bent pose and state its
angles. Demonstrate articulation if supported. Then increase upper-arm pivot
spacing to 180 mm and gripper opening from 20 to 35 mm while preserving
attachment alignment. Inspect exact geometry and assembly poses, save native
WCAD, reopen in a fresh process, and export STEP part definitions.

The intended result is more than a picture made of disconnected solids. Record
which joints, dependencies, and revisions are actually represented. Collision,
load, tolerance-stack, and manufacturing validation are outside the brief.

## Method

- The designer starts without the previous implementation conversation or
  design trials. It may read repository instructions, public usage/package
  documentation, the generic stdio client, and MCP tool schemas. It does not
  initially read implementation source, tests, or existing modeling fixtures.
- Preserve each request and response, including failures and abandoned
  approaches. Record tool latency and payload sizes, and distinguish transport
  time from design effort. Do not invent token counts.
- If source lookup becomes necessary, record the missing information first.
  Treat a later lookup as an explicit escape hatch, not normal discoverability.
- The parent observes and independently verifies outputs. It does not supply
  a hidden modeling recipe or fix the product during the baseline trial.
- Limit active design effort to approximately 25 minutes, stopping sooner if
  persistent blockers prevent meaningful progress. Record unmet requirements
  and reasonable recovery attempts rather than hiding them with unlimited work.

Designer-owned replay inputs and journal: `examples/robot-arm-trial/`.
Raw transcripts, schemas, native/STEP artifacts, and observer evidence:
`.metrics/robot-arm-trial/` (gitignored).
Compact failure requests/results and observer measurements are also preserved
in the committed `examples/robot-arm-trial/observed-evidence.json`, with setup
instructions, so the findings do not depend solely on local artifacts.

## Evaluation

Separate four outcomes for each requirement: achieved directly, achieved with a
workaround, blocked, or not attempted. Classify problems as missing capability,
confirmed defect, interface/documentation friction, or unresolved uncertainty.
Support each important finding with the attempted operation and observed result.
Prioritize follow-up work by how much of this workflow it would unblock.

## Observed problems

Call references below use session A (`2026-09-07T22-53-59.864Z`) and session B
(`2026-09-07T22-58-28.947Z`). The corresponding complete request/response lives in
`.metrics/robot-arm-trial/sessions/<session>/<call>.json`.

### Exact geometry disagrees with XZ source geometry — confirmed defect

The first hole batch failed because the finger's hole tool did not intersect
its target. A smaller probe isolated the problem: a 60 × 14 rectangle centered
at `[30, 0]` on XZ, extruded by 8, has source-analytic centroid `[30, -4, 0]`
but exact OCCT centroid `[30, 4, -14]`. Both report volume 6720 mm³, so checking
only volume would miss the defect. See A/014–016 and
`xz-geometry-probe.wcad`.

The observer independently reproduced that disagreement with a new minimal
model. Equivalent XY and YZ controls agree with their source centroids to
floating-point tolerance. Evidence: `observer/plane-source-repro.json`.
The designer recovered by defining every part on XY and orienting instances
later. That workaround added design effort and avoided testing non-XY parts in
the final model; it did not fix the underlying geometry.

### Region discovery rejects its own advertised arguments — confirmed defect

A/006–008 called `cad.sketch_profile_region_candidates` with a sketch ID,
then an explicit limit, then an entity subset. All returned `INVALID_ARGUMENTS`
despite conforming to the published input schema. A/010 attempted
`cad.sketch_profile_region_validate` and hit the same problem.

The observer reproduced a valid rectangle query succeeding through the
synchronous adapter and failing through the asynchronous adapter, with zero
execution-host calls. The wrapper catches the internal deferred-call signal
and turns it into an argument error. Evidence:
`observer/region-query-repro.json`. The designer bypassed discovery by supplying
explicit region profiles. An agent should not have to guess around a broken
discovery tool to reach supported geometry.

### Exact failure points to the wrong operation — confirmed defect

A/009 was a 38-operation body-building batch. Its error named the finger body,
but `opIndex: 37` and `$.ops[37]` identified the spacer hole. The finger's final
hole operation was index 33. The runtime assigns the last batch operation to
any exact-preflight failure, regardless of which body failed.

Atomic rollback worked. The inaccurate location still sent debugging toward
the wrong operation and made a large batch harder to repair. Preserve the
failing body/feature and its source dependency when reporting the operation.

### Assembly constraints cannot continue through an attached chain — capability limit

B/009 grounded the base, added a concentric base-to-yaw mate, then attempted
the yaw-to-shoulder mate. The latter failed with
`ASSEMBLY_MATE_UNDERCONSTRAINED`: neither participant had its own fixed mate.
The entire tentative batch rolled back. A relation to a grounded root does not
qualify an instance as a grounded participant in the next relation.

The public mate kinds are fixed, coincident, concentric, and distance. There is
no advertised angular/revolute joint or motion-driver operation. The designer
completed a static fallback with explicitly fixed parents. The two jaw distance
mates provide real limited motion; they do not make the arm an articulated chain.

### Pose and revision contracts require source lookup — discoverability friction

`transform.rotation` is advertised only as three numbers. Public usage/package
documentation did not explain units or Euler order. The public Transform type
also lacked that information; the designer inspected the rotation helper and
found radians applied X, then Y, then Z. This was the first explicitly recorded
source escape hatch.

The second was discovering how to change an existing instance transform.
Insertion and mate edits have concrete batch schemas, but the generic operation
fallback does not tell the agent the name or fields of other supported instance
operations. A narrow public-interface lookup found insert, definition replace,
and delete, with no instance transform mutation. The designer rebuilt all 29
instances and 29 mates to apply its computed revised pose.

The revision took 89 operations: two parameter updates, 29 instance deletions,
29 insertions, and 29 mate creations. The bound upper-arm dimensions rebuilt
correctly; the assembly transforms were computed outside Partbench. Gripper
opening is an informational parameter, with separate explicit mate distances.
An unnecessary full-project handoff returned 424,890 bytes before the designer
discovered that the ordinary structure query already contains assemblies.

### Length edits do not preserve geometry attachments — capability limit

The observer reopened the final native model in isolation and changed only
`upper_span` from 180 to 200 mm. The operation succeeded: the upper outline
grew from 210 to 230 mm and its holes moved from ±90 to ±100 mm. Every instance
transform and mate remained unchanged, leaving the intended pivots 10 mm away
from the new holes. The saved final model was not modified by this probe.

The mates use numeric local references, which also remain unchanged. This is
missing association to changing geometry, not proof that the solver violates
its stored numeric constraints. It explains why the designer needed an
external pose calculation and full reconstruction. Evidence:
`observer/final-native-step-check.json`, `parameterOnlyRevision`.

### Browser shows definitions alongside assembly instances — workflow friction

Both initial and final native files opened and rebuilt with all eleven exact
results ready. The screenshots show local part definitions overlapping the
base alongside the posed assembly. The browser scene currently appends
instance meshes to the definition meshes. This clutter makes visual inspection
harder even though the geometry is ready; it is not extra assembly parts
authored by the designer. An assembly-focused view should display the posed
instances clearly while retaining access to definition editing.

## Independent verification

The observer reopened `02-xy-parts.wcad` and checked all 11 finished bodies
against outline area minus circular-hole areas, multiplied by thickness.
Every exact volume matched. This proves the recovered definitions are real
solids with the intended material removal; it does not prove assembly motion,
clearance, or attachment preservation. Evidence:
`observer/parts-exact-check.json`.

The final native check independently passed all eleven exact volumes and
29 instance/29 mate counts. Upper-arm volume increased by 4,800 mm³ to
49,555.03723989049 mm³. Instance transforms match the declared revised pose
within 1.43e−14. The fresh designer process preserved native source identity
`f4e7cf724a4939e022623718190d1251cc6ff5846c17ec613d33487c57c59e63`.

Real OCCT STEP readback found eleven solids with total volume
266,204.06455060147 mm³, matching the sum of definition volumes. This checks
the combined definition export; it does not assert an assembled STEP hierarchy
or an instance-weighted assembly volume. Evidence:
`observer/final-native-step-check.json`.

The existing Bun/Chromium Use runner opened initial and final native files
through the browser Open flow, waited for ready exact results, and used Solid
and Fit All. Separate break cases opened each file, cleared a parameter field,
and verified Apply was disabled. Both journeys passed, at 10.3 and 10.8 seconds.
The existing file-picker stub supplies bytes; parsing, rebuilding, and workbench
controls are real. Success and break screenshots are under `.metrics/ui-smoke/`;
inputs and logs are `observer/browser-{initial,final}.{json,log}`. These checks
do not claim that the browser authored or articulated the arm.

The successful path also passed a clean replay through the real MCP executable
and a second process. Its assertions cover all eleven exact volumes before and
after reopening, final instance transforms/counts, mate count, and saved/opened
source identity. Any failed tool call or assertion fails the replay. See
`observer/replay-verified.log` and `replay-verified/`. The replay preserves the
successful workaround; it does not repeat the failed discovery attempts or
pretend those defects have been fixed. Scoped example-script ESLint and
formatting checks passed. No production package changed, so historical product
gauntlets were not rerun.

## Effort and limits

The original designer run recorded 85 request/response pairs, 81 tool calls,
and eight failed tool calls across three sessions. Serialized request payloads
totaled 79,000 bytes and results 1,860,598 bytes, excluding JSON-RPC envelopes
and framing. Measured call latency totaled 9.44 seconds: median 6.84 ms,
p95 300.97 ms, maximum 2.56 seconds. These counts exclude observer work and
replays. Raw evidence is in `transcript.jsonl` and `metrics.json`.

The designer estimated roughly 14 minutes from initial reading through fresh
reopen/export, plus six minutes of reporting and checks. These are approximate
effort estimates, not measured token usage or a controlled comparison. Two
documented source escape hatches mean this is not a fully blinded usability
benchmark. The journal records one avoidable mass query after a rolled-back
batch separately from product defects.

The arm is a mechanical concept. Collision freedom, loads, motor mounting,
guide/drive mechanisms, complete fastener retention, tolerance stacks, and
manufacturing readiness were not established. Unattempted mechanical detail
is not classified as a CAD defect. The diagnostic goal is complete because the
attempt, actual outcome, recoveries, open blockers, and independent evidence
are recorded and the successful path is reproducible.
