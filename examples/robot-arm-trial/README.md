# Robot arm diagnostic trial

Baseline: `d6498191c73e7b46b7c49ed1aea9c624782f8aa5`. This directory contains a designer's authored operations, not product changes. The actual outcome is an editable, exact **static arm concept with movable gripper jaws**, not a functional articulated robot assembly.

The native final is `.metrics/robot-arm-trial/robot-arm-final.wcad`. The eleven `part-*.step` files are separate AP242 part definitions. `robot-arm-part-definitions.step` contains those definitions in their local modeling frames; it is not an assembled STEP product. The observer owns `docs/robot-arm-trial.md` and independent verification.

## Replay

From the repository root with Node 22 and pnpm 10, build the executable from
the checkout you want to exercise:

```sh
pnpm --filter @web-cad/mcp-stdio-server build
node examples/robot-arm-trial/replay.mjs
```

The replay uses only the real headless MCP executable and the allowed generic stdio client. It writes to `.metrics/robot-arm-trial/replay/`, separate from the observed run, records requests/responses, creates the initial pose, revises it, moves the jaws, saves/exports, and reopens in another process. It checks all exact volumes, final instance poses/counts, mate count, and source identity across reopen, and fails if any call or invariant fails. It does not repeat the unsuccessful discovery probes; their original requests and raw failures remain in the transcript and per-call JSON files. Optional first argument selects another fresh workspace directory. Existing artifact filenames are not overwritten; use a new directory for repeated replays.

`session.mjs` is the interactive logging wrapper. JSON lines can name a tool, supply a raw MCP method, or load a request file. `build-requests.mjs` and `pose.mjs` are authoring helpers; saved JSON requests are the replay authority. `check-results.mjs` checks the original designer trial transcripts, rather than arbitrary replay runs. No runtime source is imported except the generic stdio client.

`observed-evidence.json` preserves compact baseline failure requests/results,
their setup instructions, and independent observer measurements in the repository.
It is a historical observation record, not expected passing output. Use it to
reproduce the open defects even when the gitignored original transcripts are
unavailable. The successful replay intentionally bypasses those defects.

## Actual design

There are 11 useful body definitions and 29 instances: base, yaw platter, shoulder cheek (2), upper arm, forearm, wrist cheek (2), vertical gripper rail, finger (2), 8 mm pin (4), 4 mm plain fastener shank (8), and 2 mm annular spacer (6). Pivot bores are 8.2 mm; mounting bores are 4.5 mm. The four principal pivot axes align, with 2 mm axial plate gaps at shoulder/elbow/wrist interfaces. Pins and spacers occupy those interfaces. The plain fasteners have no modeled heads, threads, or retention hardware.

The chosen pose is yaw 25°, shoulder elevation 60°, elbow −100° relative to upper arm (forearm elevation −40°), and wrist +40° relative to forearm (horizontal gripper). Gripper separation is vertical in this pose. The rail and fingers are simple conceptual parts; their guide/drive/retention and the rigid cheek/rail connections are not mechanically completed.

All final definition sketches are on XY. `parts.json` retains the original design's intended planes; request `04-xy-sketches.json` explicitly changes all planes to XY as the recorded recovery for the XZ exact-geometry defect. Instance transforms orient the finished definitions.

## Requirements achieved and unmet

| Requirement                                          | Observed outcome                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 8–12 distinct useful definitions and reused hardware | 11 exact definitions, 29 instances; shared pin, shank, cheek, finger, and spacer definitions                                                                                                                                                                                                                 |
| 160 mm upper / 140 mm forearm pivot spacing          | Initial source sketches and posed axes match                                                                                                                                                                                                                                                                 |
| Editable principal dimensions                        | Upper span is bound through expressions to overall length and both pivot centers. Forearm, bores, thicknesses, and other dimensions remain editable feature/sketch literals. Gripper opening is an informational parameter plus explicit distance-mate values; it is not associatively bound to those mates. |
| Clearly bent pose                                    | Achieved with the angles above                                                                                                                                                                                                                                                                               |
| Functional angular assembly / articulation           | **Unmet.** Multi-link relational mating failed; 23 instances are fixed in the fallback. Four pins are concentrically mated to fixed parents. Angular motion is not advertised or demonstrated.                                                                                                               |
| Demonstrate motion where supported                   | Two distance mates moved the actual fingers 35 → 25 → 35 mm. No instance replacement was needed for this motion. The informational parameter remains 35 during the temporary 25 mm demonstration.                                                                                                            |
| Upper span 160 → 180 and gap 20 → 35                 | Achieved. Parameter dimensions rebuild the upper solid. All 29 instances were deleted/reinserted with the same IDs and recomputed transforms, and their 29 mates recreated in one transaction. This is authored reconstruction, not automatic kinematic propagation.                                         |
| Retain attachment alignment                          | Source-derived posed pivot axes remain aligned after revision. Independent math checks show radial error under 3e−14 mm and nominal 2 mm plate gaps. This does not prove collision freedom or complete mechanical fastening.                                                                                 |
| Save/reopen                                          | Fresh headless process preserved the source identity, all instance/definition/mate records, parameters, exact volumes, and poses                                                                                                                                                                             |
| Usable STEP definitions                              | Eleven individual AP242 exports plus a combined definition export succeeded; fresh process exported again. STEP does not carry the mate system. Observer separately verifies STEP readback.                                                                                                                  |

Upper volume changed from 44,755.03723989049 to 49,555.03723989049 mm³, exactly +4,800 mm³. Final upper outline is 210 × 30 × 8 mm with pivot centers at approximately ±90 mm. Final source identity is `f4e7cf724a4939e022623718190d1251cc6ff5846c17ec613d33487c57c59e63`.

## Designer journal and pain points

Call shorthand below uses session A = `2026-09-07T22-53-59.864Z`, B = `2026-09-07T22-58-28.947Z`, C = `2026-09-07T23-06-14.248Z`. Full requests/responses and measured times are in `.metrics/robot-arm-trial/transcript.jsonl` and `sessions/<session>/<call>.json`.

- About 22:52–22:54 UTC: read AGENTS, public workflow/runtime docs, package READMEs, verification instructions, and allowed generic stdio client. A002 returned 104,195 serialized result bytes for `tools/list`. The initial schema extraction was overly broad; targeted extraction made it workable. This was designer workflow friction, not runtime failure.
- 22:56:16, A004: first authored transaction created 11 sketches and upper-arm bound dimensions. About 2m16s after MCP startup, roughly 4 minutes after initial document reading. Shape planning and schema reading are included in this effort.
- A006–A008: `cad.sketch_profile_region_candidates` rejected the advertised required-only arguments, then explicit limit, then explicit entity IDs plus limit, each with `INVALID_ARGUMENTS`. A010 similarly rejected schema-shaped `cad.sketch_profile_region_validate`. Judgment: public async query defect. Recovery: use explicit primitive region references already described by the batch schema. No source lookup was used for these operations.
- A009: a hole/extrude batch failed with `EMPTY_RESULT`, naming `b_finger` but attributing the operation to index 37, the final spacer hole. A011 direct region extrusion also failed for `b_finger` but attributed index 10, the spacer. Both transactions remained atomic. A013 was the designer's avoidable downstream mass query after the failed batch and correctly returned `BODY_NOT_FOUND`.
- A014–A017: isolated a 60 × 14 × 8 rectangle on XZ, sketch center [30,0]. Exact centroid was [30,4,−14], while source-analytic centroid was [30,−4,0]. The body volume agreed. Judgment: geometry placement defect with misleading failing-operation attribution. `xz-geometry-probe.wcad` preserves it. `01-parts.wcad` is only the earlier sketches, despite its premature name.
- 22:58:43, B002–B005: all-XY recovery produced eleven exact bored solids; saved `02-xy-parts.wcad`. Roughly seven minutes of design effort had elapsed.
- B006: a fixed base with one concentric yaw instance succeeded and preserved its input rotation. The public transform schema did not say radians versus degrees or Euler order. The first probe used 25 as an angle; it was discarded by opening the part-only checkpoint. See the bounded source escape below.
- 23:00:49, B009: `fixed base → concentric yaw → concentric shoulder` failed with `ASSEMBLY_MATE_UNDERCONSTRAINED`, “neither instance fixed” on the second relation. A relationally positioned parent is not accepted as grounded. Judgment: unsupported multi-link assembly workflow. The trial stopped pursuing angular articulation after this meaningful blocker, rather than inventing undocumented revolute joints.
- 23:04:41, B011–B013: saved the explicitly named static concept. B012 showed that all transforms, including the two jaw distance mates and four concentric pins, matched authored positions.
- 23:05:14, B014–B019: the real span/opening revision passed dry run and commit. No supported public instance-transform operation was found; the recorded workaround deletes/reinserts instances and recreates their mates. This preserves a reviewable static design result but exposes missing revision ergonomics and no automatic chain propagation.
- 23:05:29, B020–B025: actual jaw distance-mate motion and final save. These edits are a genuine supported limited motion path.
- 23:05:41–23:05:42, B026–B049: exact inspection, individual/combined STEP exports, and session counters.
- 23:06:23–23:06:25, C002–C018: fresh-process native reopen, structure/parameter inspection, all eleven mass queries, and another STEP export. Designer checks then compared source-derived axis/clearance math and analytical volume/centroid expectations. The first comparison used JSON key order and was corrected to semantic deep equality; records themselves were unchanged.

The design phase took roughly 14 minutes from initial public-doc reading through fresh-session export. Reporting and deterministic evidence checks brought total active trial work to roughly 20 minutes. Recorded MCP call time totals only 9.44 seconds; the larger cost was reading schemas, design decisions, debugging, and authoring/revising operations. This was not a controlled timing comparison with another CAD tool.

## Explicit source escape hatches

The parent approved each narrow lookup after the missing public contract was reported. No implementation modeling source, tests, previous design fixtures, or prior trials were consulted otherwise.

1. Rotation units/order: `packages/cad-protocol/src/index.ts:196–200` defines `Transform` without units. `packages/cad-core/src/engine.ts:30702–30719`, only `rotateEuler`, establishes radians and X then Y then Z. A targeted `rg` search first located these definitions; adjacent search matches were not used as modeling guidance.
2. Instance revision operation: `packages/cad-protocol/src/index.ts:1705–1713` and `1799–1812` expose insert, definition replace, and delete with mate cascade deletion. No instance transform mutation is present in that public operation union. This enabled the explicit delete/reinsert fallback; no mutation implementation was read.

## Metrics and checks

Original designer run: **85 request/response pairs, 81 tool calls, 8 failed tool calls**, across three process sessions. There were 13 batch calls, 26 mass-property calls, 7 structure calls, 13 STEP export calls, 7 saves, and 2 opens. Failures include the one avoidable dependent query after an atomic rejection.

Serialized request payloads totaled 79,000 bytes; serialized MCP results totaled 1,860,598 bytes. These counts exclude JSON-RPC envelope/framing bytes. Total measured call latency was 9,435 ms; median 6.84 ms, p95 300.97 ms, maximum 2,556.33 ms. The largest response was 424,890 bytes for an assembly batch requesting a full project handoff. The ordinary structure query already contains assemblies, so the full handoff was unnecessary after that discovery.

`designer-checks.json` reports all eleven expected volumes and centroids passing, initial/revised/motion/reopened axis and plate-gap checks passing, and native source/assembly persistence passing. `metrics.json` preserves counts, per-tool totals, and all eight raw failure summaries. These are designer checks; the observer's separate report is the independent evidence.
