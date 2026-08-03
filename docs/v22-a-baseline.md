# V22 Gate A Baseline

- Recorded: **2026-08-03**
- Completed production baseline: `bba415b9b70137c8acbcbf395dcab6844668d040`
- Approved V22 plan/DAG: `afd6bd69b4e5dd69ad93b9239167826215420e30`
- Node: `v22.22.1`
- Browser: inherited release environment `HeadlessChrome/151.0.7922.34`

All seven inherited V21.1 release commands passed serially before V22
production changes:

| Command | Result |
| --- | --- |
| `pnpm smoke:v21-1-hole-workflow` | 47 checks passed, including real OCCT |
| `pnpm smoke:v21-1-downstream-workflow` | 45 checks passed, including real OCCT |
| `pnpm smoke:v21-1-portability-workflow` | 77 focused checks plus production-browser OPFS, recovery, `.wcad`, agent, and exact STEP workflow passed |
| `pnpm smoke:v21-1-agent-export-workflow` | production-browser manual/approve-all exact export and download workflow passed |
| `pnpm smoke:v21-1-browser-limit` | exactly 256 active bodies, cold/cancel/warm export, restart, eviction, STEP, and `.wcad` reopen passed |
| `pnpm check:v21-1-bundle` | all fixed gzip ceilings passed |
| `pnpm smoke:v21-1-release-samples` | 169 checks passed: 47 hole, 45 downstream, 77 portability |

The immediately preceding completed release evidence in
[`docs/v21.1-g-gate.md`](./v21.1-g-gate.md) remains the inherited record for
the required V18 performance/browser proof, eight V19 commands, three V20
commands, eight V21 commands, and full repository validation: 2,926 workspace
tests, 98 script tests with one intentional skip, all 12 package typechecks,
format, serial build, lint with zero errors and six retained warnings, and
`git diff --check`. V22 Gate A does not relabel that inherited evidence as a
fresh rerun; its seven V21.1 commands above were rerun on the approved V22
planning commit.

## Browser and Limit Evidence

Browser commands used `PARTBENCH_SMOKE_BROWSER_NO_SANDBOX=1`, the same
container requirement recorded by V21.1. The first restricted portability run
reached the stdio launcher and exited before loopback was available. The first
approved loopback run omitted Chromium's container flag and timed out waiting
for remote debugging. The complete named command then passed with both the
approved loopback boundary and recorded flag. These were environment-only
retries; no assertion or workflow was skipped.

The production 256-body workflow recorded:

| Measurement | Result |
| --- | ---: |
| Body count | 256 |
| Operation p50 / p95 | 564.08 ms / 1,026.11 ms |
| Cache clear | 83.60 ms |
| Cold artifact p50 / p95 | 68.22 ms / 123.58 ms |
| Cold STEP | 4,606.03 ms |
| Cold end-to-end export | 282,266.86 ms |
| Warm artifact p50 / p95 | 62.70 ms / 109.18 ms |
| Warm STEP | 5,245.99 ms |
| Warm end-to-end export | 202,745.83 ms |
| Worker restart | 71.90 ms |
| Eviction p50 / p95 | 996.36 ms / 996.36 ms |
| STEP bytes | 5,065,081 |
| `.wcad` bytes | 76,156 |

The portability workflow separately recorded recovery p50/p95 at
110.41/116.53 ms and a 46,981-byte exact STEP result. Timings are baseline
evidence, not cross-hardware promises.

## Fixed Bundle Baseline

| Artifact class | Measured gzip | Fixed limit | Headroom |
| --- | ---: | ---: | ---: |
| Critical UI JavaScript | 408,108 | 409,600 | 1,492 |
| Critical CSS | 5,966 | 20,480 | 14,514 |
| All non-worker UI JavaScript | 563,192 | 563,200 | 8 |
| Command worker | 262,137 | 262,144 | 7 |
| Geometry worker | 93,709 | 122,880 | 29,171 |
| OCCT WASM | 13,808,536 | 13,808,536 | 0 |

All-UI and command-worker headroom are blocking budgets. Dynamic imports can
protect critical startup but cannot reduce the all-UI total. The deletion-first
slice plan in `docs/v22-implementation-dag.md` is required before a capped
artifact grows.

## Baseline Scope Audit

- `CadBodySource["type"]` remains the completed 13-member V21.1 union.
- Project schema remains minimum-triggered through `web-cad.project.v22`.
- `.wcad` remains `partbench.wcad.v2`.
- Approval modes remain exactly `manualApproval` and `approveAll`.
- The workspace package set and production dependencies are unchanged.
- Existing agents retain no screen, OPFS, recovery-package, raw-byte, path,
  handle, or new file authority.
- V22 production behavior is absent at baseline.

Gate A remains open until every requirement in
[`docs/v22-implementation-dag.md`](./v22-implementation-dag.md#gate-a) passes,
including test-only contract/rejection, selection, collector, preview/grip,
measurement, recovery, accessibility, limit, and no-widening fixtures; the
measured deletion plan; affected typechecks; touched lint/format;
`git diff --check`; and independent scope review.
