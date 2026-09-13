# Independent public-interface gearbox trial

Outcome: geometry, coupled motion, and STEP export succeeded; reopening the revised native assembly is blocked by a reproducible transaction-history replay failure. No product source, tests, history, or other model examples were read. No product code or Git state was modified. Work used only AGENTS.md, usage.md, public MCP discovery, and the installed executable through the supplied real stdio client.

## Design and native revision

- External 20T input / 40T output initially; module 1.5 mm, 20° pressure angle, 10 mm faces, 8.1 mm bores, 0.08 mm tooth thinning per gear (0.16 mm combined).
- One 90×24×4 mm support plate, two 8.2 mm clearance holes, and two instances of an 8 mm diameter ×20 mm shaft.
- Grounded support. Source-linked support-hole frames locate revolute shaft joints; gears follow their shafts through zero-angle revolute connections. Both gear definitions span local Z=0..10 and resolved assembly Z=2..12. Shafts span Z=-4..16.
- Stored expressions: `center_distance = module * (input_teeth + output_teeth) / 2`; `output_angle = 180 / output_teeth - input_angle * input_teeth / output_teeth`. The phase offset is one half-tooth pitch; this is prescribed kinematics, with no force/contact or manufactured clearance validation.
- A single committed operation, `parameter.update` of `output_teeth` from 40 to 60, regenerated the output gear and moved its support hole and shaft from 45 to 60 mm. IDs and the input gear were retained. No external script recomputed shape, spacing, or ratio after the update.

## Measured evidence

| Quantity | Before (20/40) | After (20/60) |
|---|---:|---:|
| Input exact volume, mm³ | 6328.635905883286 | 6328.635905883286 |
| Output exact volume, mm³ | 27405.732253281967 | 62617.580781870165 |
| Support exact volume, mm³ | 8217.518619945244 | 8217.518619945244 |
| Support centroid X, mm | 30.38559211082528 | 30.000000000003734 |
| Center spacing, mm | 45 | 60 (within 1e-7) |
| Driven angular ratio | −1/2 | −1/3 |

| Input angle | Resolved output angle | Gear face Z ranges |
|---:|---:|---|
| 0° | 3° | Both 2..12 mm |
| 60° | −17° | Both 2..12 mm |
| 120° | −37° | Both 2..12 mm |

Only bounded `projection:"poses"` queries were used for assembly inspection, with assembly and instance filters for motion. Definition arrays were empty. Six offline numerical checks against the public responses passed; see `checks.json`. Exact measurements came from `cad.body_mass_properties` with kernel-derived provenance. STEP headers were checked for ISO-10303-21 and AP242; files were not independently reimported.

## Native persistence blocker

`workspace/gearbox-20-40.wcad` saved (433,670 bytes) and reopened successfully in a fresh process. `workspace/gearbox-20-60.wcad` saved at input 120° (65,361,618 bytes), but fresh-process open failed:

> PROJECT_OPERATION_FAILED: Invalid Partbench project JSON: Project transaction history could not be replayed: Saved transaction diff does not match replayed operations for txn_2. ($.history).

A second fresh process reopened the original 20/40 file, committed only `output_teeth=60`, and saved immediately before any exact measurement queries or further angle changes. `workspace/gearbox-20-60-immediate-save.wcad` (65,357,110 bytes) reproduced the same failure in another fresh process. This rules out the later angle sweep or mass-property queries as necessary triggers. The root cause was not investigated because the trial prohibited product implementation inspection. Both failed files and raw responses are preserved.

STEP was recovered from the live revised session using the documented part-definition export path. `input_gear.step`, `output_gear.step`, `support.step`, and `shaft.step` are individual part definitions; the shaft is used twice. STEP does not preserve the assembly placement or mates, as documented. The original native file is usable; neither revised native file should be presented as a successful native handoff.

## Interface observations and workarounds

1. The single output-tooth revision returned **130,885,256 bytes** of MCP response in each attempt, compared with 1,079,899 bytes for the initial complete creation. The revised native files grew from approximately 0.43 MB to 65.36 MB. These are measured sizes, not a diagnosis. Compact pose responses worked as advertised.
2. Parameter-expression discovery exposes a string, without a grammar or binding-name rule. Conventional arithmetic using names identical to IDs worked first try; the expressions were preserved in the public parameter response.
3. The mass-property tool description promises bounds, but the actual responses contained volume, surface area, centroid, and inertia without bounds. Geometry evidence therefore uses exact volumes and centroids; assembly face alignment additionally uses authored face width and resolved transforms.
4. Reopening a saved revision is the remaining task failure. Immediate-save retry did not work. Exporting individual STEP definitions from the live session recovered useful geometry.

## Reproduction and artifacts

All files are under `/private/tmp/partbench-gearbox-validation`.

- `creation-ops.json`: authored native design operations.
- `discover.mjs`, `schemas.mjs`, saved schema JSON and `tools.json`: public discovery.
- `build.mjs`: initial design creation and save.
- `validate.mjs`: exact before/after geometry, single tooth revision, three input angles, revised save.
- `reopen-export.mjs`: first fresh-reopen failure.
- `recover.mjs`, `retry-reopen.mjs`: minimal immediate-save reproduction and live-session STEP recovery.
- `calls.jsonl`: every actual initialize/discovery/tool request, full response, errors, timestamps, and measured round-trip durations. Large raw responses are intentionally preserved.
- `evidence.json`, `immediate-reopen-evidence.json`, `recovery-evidence.json`: focused returned evidence.
- `summarize.mjs`, `checks.json`, `summary.json`: offline numerical checks, artifact headers, and timings derived from the recorded responses.

Trial started at 2026-09-12 07:53:10 UTC. Approximately seven minutes were spent on active trial work. No browser UI, independent STEP import, motion contact solver, or manufacturing assessment was part of this bounded public-headless trial.

Trial completed at 2026-09-12 08:00:47 UTC (about 7 minutes 37 seconds, including report generation). All four STEP exports completed successfully.
