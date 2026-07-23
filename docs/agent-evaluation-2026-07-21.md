# Independent Part-Building Evaluation — 2026-07-21

Three evaluator agents received isolated briefs and browser profiles containing
only a target-part description and the instruction to use Partbench's rendered
controls. They were not given prior feedback, implementation details, suspected
issues, or source/test access. Their browser runs executed concurrently on the
same host.

## Tasks and outcomes

| Task | Successful work | Outcome |
| --- | --- | --- |
| Clevis bracket | Created the 60 × 30 × 8 mm feature-backed base | Blocked when the Chromium page target crashed during post-Apply display work; ears and hole were not attempted |
| Stepped pulley | Created separate coaxial Ø50 × 12 mm and Ø32 × 18 mm cylinders | Partial; bore and groove were not completed because the single-part combination/subtraction path was not discoverable |
| Six-hole pipe flange | Created the Ø80 × 10 mm cylinder blank | Blocked when the page became nonresponsive immediately after Apply; bore and bolt holes were not attempted |

No evaluator completed the requested part.

## Findings

### 1. High evaluation risk: host exhaustion confounded the parallel evaluation

This was the only cross-evaluation reliability failure. It appeared after both
Box and Cylinder creation:

- The clevis run committed `Box 1 profile` and `Box 1`, then Chromium reported
  `Target crashed` / `Page crashed` during later capture and interaction.
- The flange run committed `Cylinder 1`, showed repeated `Building display
  geometry`, and then stopped responding.
- The pulley run created two cylinders, but display work remained in
  `Building display geometry` / `Building results`; Fit all timed out once.

A fresh-profile retest on the still-constrained evaluation host appeared to
reproduce the flange failure:

1. Open a new document.
2. Choose Cylinder.
3. Set Radius to 40 mm and Height to 10 mm.
4. Apply.
5. Within roughly 1–3 seconds, attempt to read status, open Document tree, or
   invoke Fit all.
6. The page stopped processing interaction before a ready state was observable.

Adversarial follow-up corrected the diagnosis. An isolated production Chromium
run completed the same Radius 40 mm × Height 10 mm Cylinder in approximately
13.25 seconds, remained responsive, and emitted no runtime or target-crash
errors. The evaluation host had approximately 3.7 GiB RAM and no swap. Its
cgroup reported a historical 3.36 GiB memory peak and 41 OOM kills, while one
cold Chromium/OCCT run reached roughly 1.5 GiB summed process-tree RSS. Those
measurements strongly implicate host resource exhaustion in the parallel
failures, but do not prove causality: the OOM counters were not captured as
per-run deltas and summed RSS can count shared pages more than once. They are
not evidence of a deterministic single-tab Partbench freeze.

At evaluation time, Partbench still had a real efficiency and recovery problem:
a trivial first body had a costly OCCT cold path, and a silently stalled/killed
geometry worker had no timeout or explicit retry path. The subsequent repair
adds serialized scheduling, worker-entry acknowledgement with optional
calibrated timeout support, explicit cancel/retry, and resource-aware browser
gating. On 2026-07-22, a Playwright
Chromium binary was found and the strengthened headless Cylinder smoke passed
with the frozen default 256 MiB reserve: display was visibly ready in about
7.7 seconds, exact in about 7.9 seconds, the largest heartbeat gap was 168 ms,
incremental cgroup memory peak was about 836 MiB, and no new OOM event was
recorded. A final post-review rerun also passed after the compact worker-start
transport landed: display and exact were visible about 8.7 and 8.9 seconds
after commit, the largest heartbeat gap was 246 ms, incremental cgroup memory
peak was about 766 MiB, and the OOM-event delta remained zero. An earlier
attempt truthfully produced `NOT RUN` when transient usable
headroom was roughly 68 MiB short of the 2 GiB admission requirement. This
small pair of default-reserve runs validates the repair path and admission behavior;
it does not satisfy the cold/warm, headed, private/PSS, or three-agent resource
matrix and does not prove OOM causality. The repair plan is recorded in
`docs/v18-display-geometry-reliability-plan.md`.

### 2. Medium: common single-part workflows lack a discoverable body-combine path

The pulley evaluator produced two correctly sized, coaxial cylinders, but they
remained separate overlapping bodies. The selected-body surface offered Choose
face, Measure, and Inspect; no union/combine action or next-step guidance was
visible. Consequently it was unclear whether a later bore could cut the entire
stepped form.

This is a capability/discoverability gap, not a regression: generic Boolean
union is outside the completed V17/V18 matrix. The product should either expose
a supported single-profile/revolve route for this shape at the point of need or
state plainly that separate quick bodies cannot be combined in the current
release.

### 3. Medium: quick primitives are poor building blocks for staged geometry

Box and Cylinder correctly disclose that they create separate feature-backed
bodies on the Top plane and cannot move along Z. That honesty is an improvement,
but it leaves ordinary tasks such as upright clevis ears or axially positioned
pulley stages dependent on a less-obvious sketch/extrude workflow.

The issue is now workflow guidance rather than a misleading input: after quick
creation, the UI does not direct the user toward the supported face-attached
sketch and add-extrude route.

### 4. Medium: pattern scope does not cover the flange bolt-circle task

The visible command is accurately named Circular Body Pattern. A six-hole bolt
circle needs repeated hole-feature or sketch-entity semantics, not repetition
of the complete flange body. The current label prevents a false promise, but
the task remains outside the visible supported pattern workflow.

This is a missing-capability finding. No feature-pattern command should be
inferred or added during V18 maintenance.

### 5. Low confidence: initial viewport framing can obscure newly created bodies

The pulley evaluator saw severely oversized/clipped geometry after the second
cylinder. Fit all timed out in one run but was available in a fresh run. This is
not yet a confirmed deterministic defect; it should be retested after resolving
the display-geometry hang because the two symptoms may share a cause.

### 6. Low: progress feedback is truthful but not diagnostic enough

Evaluators observed `Updating model`, `Building display geometry`, and
`Building results` for several seconds. When the page stalled, those states
provided no elapsed time, failure threshold, or recovery action. Result-state
truth was better than a false `Ready`, but a hung build had no actionable escape
or retry path in the evaluated revision. The subsequent repair adds those
controls; production-browser verification remains required.

## Excluded observations

- One evaluator suspected unlabeled numeric inputs. Verification found visible
  `<label>` elements correctly associated through `for`/`id`, plus unit
  descriptions through `aria-describedby`; this is not an accessibility defect.
- The clevis brief omitted ear height and hole-center height. That specification
  ambiguity is not a Partbench issue.
- The agents did not prove that Hole itself failed. Display failure prevented
  them from reaching the hole workflows.

## Recommended next investigation

Prioritize the dedicated, resource-isolated browser baseline and recovery work
in `docs/v18-display-geometry-reliability-plan.md`. Capture page and worker
outcomes separately, per-run cgroup memory-event deltas, private/proportional
memory, main-thread responsiveness, operation queue/execution time, and
derived-geometry transitions. Re-run the three part evaluations serially only
after those gates pass; otherwise resource pressure can be mistaken for product
behavior.
