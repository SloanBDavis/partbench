# V22 Gate A Evidence

Status: **Passed (2026-08-03).**

This record closes the planning and test-only baseline gate before V22
production work. The binding scope remains in [`docs/v22.md`](./v22.md), the
landing order remains in
[`docs/v22-implementation-dag.md`](./v22-implementation-dag.md), and the fresh
inherited release measurements remain in
[`docs/v22-a-baseline.md`](./v22-a-baseline.md).

## Frozen contract inventory

`packages/cad-core/src/v22Baseline.test.ts` freezes without exporting product
behavior:

- all 13 current body-source families, their inherited fixture cases, the
  V22 recursive/recovered additions, and body/face/edge/vertex selection;
- active, healthy, current, exact-ready, identity-bound, within-limit
  preconditions; every inherited blocker; and truthful body-only fallback;
- existing collector eligibility, body policies, durable forms, shape guards,
  consuming CADOps, promotion prerequisites, and generated-vertex naming;
- the exhaustive current feature preview/grip and exact measurement matrices;
- the one future `selection.referenceCandidates` query seam, new-evidence
  private-field rejection, and grandfathered viewport-input no-egress rule;
  and
- fixed recovery, pick, preview, inspection, annotation, section, interaction,
  and accessibility limits.

The collector audit corrected three planning details against the existing
protocol: `feature.updateShell` changes open faces but cannot retarget the shell
body; update mirror and pattern operations can change their plane/axis
references; and an existing generated vertex may be named although an
arbitrary exact vertex cannot become a topology anchor.

Actual additive query parsing, private-field rejection, and no-egress behavior
remain owned by Slice D and the final security gate. Slice A adds no exported
protocol member or runtime validator for a contract that does not exist yet.

## Validation

The following passed serially on the low-spec release machine:

```sh
pnpm exec prettier --check packages/cad-core/src/v22Baseline.test.ts docs/v22-implementation-dag.md docs/v22-a-baseline.md docs/v22-a-gate.md
pnpm --filter @web-cad/cad-core exec vitest run src/v22Baseline.test.ts
pnpm --filter @web-cad/cad-core typecheck
pnpm exec eslint packages/cad-core/src/v22Baseline.test.ts
git diff --cached --check
```

Vitest passed one file and four tests. An independent adversarial review first
rejected the draft for incorrect handoff semantics, missing update collectors,
an inaccurate shell-target row, inert fixtures, and missing source/limit/privacy
coverage. It accepted the corrected fixture with no remaining material
finding. The only final prose mismatch—omitted `unsupported` outcome wording in
the DAG—was corrected with this record.

## Scope and budget audit

- No production source, exported protocol member, command, query, renderer,
  worker operation, storage behavior, schema, `.wcad` version, package,
  dependency, or approval mode changed.
- The fixed bundle measurements and near-zero UI/command-worker headroom remain
  blocking budgets from the baseline record.
- The deletion-first plan remains binding: Slice B extends the existing exact
  artifact path; Slice C replaces approximate exact-ready face/edge picking;
  Slice F replaces approximate subentity pair measurement; Slice G reuses
  existing `.wcad` and OPFS primitives; Slice D extends the current command
  worker query dispatch.

Gate A is closed. Slice B may add same-shape private pick evidence only; it may
not enable UI selection or widen commandability.
