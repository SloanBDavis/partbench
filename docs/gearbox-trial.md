# Gearbox agent trial

Status: complete diagnostic, September 7, 2026 (America/Chicago).
Baseline: `adab4e078fd592e149b2d408996e978c4d0e86c5`.
No product fixes or new release are included in this trial.

A fresh designer built a connected gearbox through the public headless interface,
then changed it from 2:1 to 3:1. **Assembly motion works. The main gaps are slow
motion updates, expensive authoring/revision, incomplete operation discovery,
and source-dependent modeling restrictions.** This is a useful CAD demonstrator,
not a mechanically finished gearbox.

## Method

The user requested the same independent experiment as the robot arm, without
telling the designer that we were looking for application fixes. The subagent
started with `fork_turns: none`, a mechanical design brief, the unchanged public
usage guide and a generic stdio client. It used a separate design folder and
the installed baseline executable. It had no implementation conversation,
prior trial findings, development documents, source or other examples. This
is contextual isolation, not a separate security sandbox.

The designer was asked for 6–10 useful definitions, real tooth profiles, reused
hardware, a full input revolution with the intended output ratio, a 3:1 revision
retaining the input gear/tooth size, alignment/interference checks, native
save/fresh reopen and STEP deliverables. About 25 minutes of design/reporting
was budgeted. It reported missing public contracts before any source escape;
**no source lookup occurred**. The parent observed without providing a modeling
recipe, then independently checked the saved artifacts. The parent's browser
findings were not fed back into the design attempt.

[Brief, journal, replay and evidence](../examples/gearbox-trial/README.md).
Original logs/artifacts: `.metrics/gearbox-trial/designer/`; observer outputs:
`.metrics/gearbox-trial/observer/`. A manifest and compact evidence are checked
in so the conclusions do not depend only on ignored files.

## What the designer achieved

| Requirement | Observed result |
| --- | --- |
| Recognizable gearbox | Eight finished definitions, 15 instances: two gears, shaft, bridge, base, spacer, standoff and square-head bolt; repeated hardware shares definitions. |
| Real tooth geometry | Sampled involutes: 20/40/60 teeth, module 1.5, pressure angle 20°, 10 mm face; 620/1,240/1,740 outline segments. Faceted flanks and unfilleted roots limit physical claims. |
| Connected motion | Both shafts have revolutes bound to expressions. Gears/spacers follow their shafts. A 360° input produces −180° or −120° output travel. Native save/reopen preserves this relationship. |
| 2:1 → 3:1 revision | Retains input geometry and all body/instance identities, replaces output/support sketch profiles and edits joint origins/one fixed bolt transform. Centers change 45 → 60 mm. The main revision takes 1,763 operations, plus four rebound dimensions. |
| Editable dimensions | Bores, shaft diameter and current base dimensions are natively bound. Tooth count/module require external profile generation and coordinated changes. `center_distance` evaluates a value but does not drive numeric joint origins. |
| Native and STEP | Both native files reopen. Nine individual AP242 exports cover eight final definitions and the original 40T wheel. STEP files are definitions, not a posed/mated assembly export. |
| Interference/engagement | Sampled polygon checks, pose/axis checks and nominal clearances pass. No native continuous collision/contact analysis was demonstrated. |
| Physical readiness | Incomplete: no gear-to-shaft key/clamp, shaft axial retention, real bearing specification, threads/nuts, root finishing or load/manufacturing validation. |

The persisted relationship is `output_angle = 180 / output_teeth - input_angle / ratio`,
where `ratio = output_teeth / input_teeth`. The first term is a tooth-space phase,
not extra output travel. This proves prescribed kinematics; contact does not
supply torque or determine motion. Dedicated gear mates are not a prerequisite
for this particular demonstration.

## Pain points and classification

1. **Motion latency and misleading transient status — observed product workflow
   problem.** Browser Open eventually renders all eight definitions. Editing only
   `input_angle` temporarily marks the gears unsupported, removes their ready
   display results, and rebuilds them. The first browser run failed the 10-second
   exact/display readiness assertion even though the pose values already matched.
   Adding the runner's existing readiness wait made edit/Undo/Redo pass. This is
   slow recovery, not proof of permanently unsupported gear geometry. The full
   2:1 browser journey remains outside the fast regression suite. Independent
   headless angle batches took 1.4–1.6 s at 2:1 and 2.5–3.1 s at 3:1 on this
   machine, with other observation work running; these are observations, not
   controlled performance benchmarks. Root cause is not established here.

2. **Incomplete public operation discovery — interface gap.** The batch schema
   explicitly describes only a subset of supported operations. Lines, arcs and
   splines fall through an untyped operation object. A guessed `sketch.addLine`
   succeeded; guessed Combine and sketch-update requests returned generic
   `INVALID_ARGUMENTS`. Missing schema detail made the agent infer contracts.
   Those invalid requests are not proof that the intended operation is absent.
   A later `cad.sketch_get` failure was an ordinary authoring error (`sketchId`
   instead of documented `id`) with a useful correction message.

3. **Detailed profile limit — capability/performance boundary.** The 620-edge
   pinion region with a bore hit `SKETCH_REGION_COMPLEXITY_LIMIT` at the analytic
   predicate-visit limit. Extruding the same outer wire worked. A typed through-all
   Hole then made the bore. This preserved exact solids but required discovering
   and switching authoring paths. Raising a guard alone is not an established fix.

4. **Source-dependent solid composition — independently reproduced restriction.**
   A circular cut-extrude was rejected on the wire gear. The observer reproduced
   the same rejection with a square made of just four lines; an equivalent
   rectangle-based square accepted the identical bore cut and produced the expected
   exact volume. Rejection preserved source identity. Bolt construction similarly
   required a rectangular head first, then a cylindrical add, after region and
   circle-target routes failed. These are explicit capability restrictions rather
   than evidence that OCCT cannot perform the boolean.

5. **Parameter/revision overhead — missing end-to-end authoring convenience.**
   Motion expressions are native, but gear shape and support spacing are generated
   coordinates. Changing `output_teeth` alone changes the ratio without changing
   geometry. The successful revision preserves identities but requires hundreds
   of new edges, replacement profiles and numeric frame edits. Old sketches remain;
   the output feature can still say “40T” after becoming 60T. A discoverable gear
   authoring operation should coordinate geometry and design dependencies.

6. **Large responses — observed agent cost.** The designer made 151 tool calls,
   including seven rejections. Logged request/result payloads totaled 1.681 MB /
   48.821 MB; 34 structure queries contributed 39.811 MB of responses. Some repeated
   inspection was the designer's choice, but obtaining a few assembly poses via
   full structure responses repeatedly returned thousands of sketch edges.
   Summed request time was 376.8 s. Schema discovery adds 122,769 response bytes.
   Counts exclude JSON-RPC framing and parent verification calls.

7. **Health and visual feedback — unresolved semantics.** Native health reports
   `unsupported`, 14 issues: 12 under-defined sketches and two unproven generated
   reference correspondence notices on the consumed wire blanks. Exact finished
   gear volumes and STEP readback pass independently. The browser still says
   “Needs attention” once all active results are ready. Under-definition is real;
   the report should make the distinction between source constraints, consumed
   topology correspondence and usable finished solids clear. This trial does not
   claim the health result is clean or every notice is a false positive.

The designer also tried to inspect its separate authored HTML drawing. Its tool
blocked local-file navigation. This is an environment limitation, not a Partbench
bug or product viewport evidence. The parent used the repository's existing real
Chromium workbench runner successfully. No second browser harness was added.

## Independent verification

- Read native authoritative sketch edges: closed outlines and actual 20/40/60
  tooth counts, expected tip/root radii and 8.1 mm bores. Exact gear volumes match
  polygon integration minus the circular bore: 6,326.062941, 27,399.920508 and
  62,613.575875 mm³.
- Open each final native file through a fresh real MCP process. At five angles
  per ratio, check both actual gear rotations, output mate values, center spacing
  and gear Z placement. Output travel is measured relative to saved phase.
- Read the three distinct exported gears back through OCCT. Each is one solid
  and has the expected volume. This is independent STEP readback, not a text-header
  check. The designer separately checked exact volumes for all eight definitions.
- Independently test saved polygon outlines at 73 ideal poses per ratio: no
  overlap at those samples. The designer's separate generated-profile check used
  361 poses. Neither is continuous swept 3D interference or loaded contact proof.
- Chromium native Open → input 90° → Undo → Redo passed with all active exact and
  display results ready; a fresh tab blocks an empty input without changing pose.
  The initial shorter assertion failure and the successful readiness-wait run
  are both retained. Screenshots were visually inspected. Browser coverage is
  for the 2:1 artifact only.
- Curated successful requests replay passed through a separate headless workspace;
  source identity, assemblies and volumes are compared across fresh reopening.
  Replay status and generated artifacts are recorded in
  `.metrics/gearbox-trial/replay/`. No production package changed; no historical
  gauntlets or GitHub CI were run.

## What this should steer next

The next user goal should be: **an agent can build this gearbox with a small,
documented request, change its ratio coherently, and scrub its input angle in
the browser without rebuilding unchanged solids or losing the gears.**

The first bounded work is motion-only invalidation/caching and truthful rebuild
status, complete discovery for the operations this attempt needed, and consistent
wire/region solid composition. These have concrete reproductions now. A small
gear generator with coherent tooth-count/spacing dependencies and a compact
assembly-pose query would remove much of the remaining authoring and payload cost.
Sampled interference checks are the next validation capability to prove with this
same model. A broad physics solver or many additional joint types are not
prerequisites for the demonstrated workflow.

These are recommendations from the experiment. Product fixes require the next
user goal; this record does not silently start that implementation.
