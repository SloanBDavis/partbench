# V22 Gate G Evidence

Status: **Passed (2026-08-31).**

This record closes crash recovery and dirty-project guards. The binding
scope remains in [`docs/v22.md`](./v22.md), and the frozen matrices and
landing order remain in
[`docs/v22-implementation-dag.md`](./v22-implementation-dag.md). Gates A–F
stay passed and unreplayed. This product gate predates the later I close.

## Outcome

After a committed source change makes the project dirty, the browser lazily
exports an ordinary `.wcad` package (v1 or v2, whichever the ordinary writer
emits for that document) including currently available checkpoint payloads.
Writes use a third private OPFS namespace, `partbench-crash-recovery-v1`,
distinct from both derived caches. A new generation is written under a new
private name, closed, ZIP-preflighted and hashed, then validated through the
ordinary `.wcad` reader before the current-generation record is published.
At most two validated generations remain. A failed, cancelled, quota,
corrupt, stale, or interrupted write leaves the prior valid generation.

Startup reads a small untrusted local-storage marker first and opens OPFS
only when indicated. The marker cannot restore a project. A valid generation
offers one Restore/Discard choice and never auto-replaces the document.
Restore uses the existing atomic `.wcad` open path, hydrates matching
checkpoints, clears stale previews/selections/jobs, and opens unsaved/dirty.
Discard removes both generations and the marker only after a second confirm.
Matching `.wcad` Save/Save As clears recovery only after saved source
identity matches the live project.

New, Open, JSON load, and Restore share one Save/Discard/Cancel project
dirty guard. The existing editor-draft guard still runs first. Save permits
replacement only after Save succeeds. `beforeunload` is registered only
while dirty and never starts a recovery write. OPFS unavailable/denied/full
is visible and non-fatal.

No CadOp, schema, `.wcad` version, workspace package, production
dependency, approval mode, cache format, or agent authority was added.

## Named closer

Gate G passed on the named closer:

```sh
pnpm smoke:v22-recovery-workflow
```

That command covers frozen byte/count limits, ZIP preflight, marker
peek-without-OPFS, two-generation publish, interruption-before-publish
orphan cleanup, quota retention of the prior generation, matching-save
cleanup, namespace isolation from derived caches, coalesced dirty-only
scheduling, Restore/Discard and replacement dialog copy, editor-before-
project guard ordering, and `beforeunload` registration only while dirty.

## Validation completed

The named closer passed 55 targeted web checks from
`2e35b39ab8182bfce81ae8f8cd525427e40fdf83`:

```
Test Files  11 passed (11)
Tests  55 passed (55)
```

`pnpm --filter @web-cad/web typecheck` and `git diff --check` passed.

`pnpm dev` at http://localhost:5173/ was driven in Chromium:

- committed Box → Crash recovery Current (`Untitled project · Source c3be9985`);
- reload showed Restore/Discard facts (name, time, identity summary, units,
  bodies, portability) and did not auto-replace;
- Restore opened unsaved/dirty with the box;
- New showed Save/Discard/Cancel; Escape cancelled; Discard created a new
  project;
- Discard recovery required a second "Discard recovery data" confirm;
  Cancel kept the snapshot;
- dirty `beforeunload` showed the browser leave-site dialog.

## Honest leftover

This environment did not force a mid-write OPFS abort (kill the tab
during `createWritable` before close). Unpublished-generation cleanup is
covered by the named store test that plants an orphan `g-*.wcad` and
proves the prior published generation remains. Quota and permission
faults were proven with an in-process OPFS mock, not a full-disk browser.

Keyboard focus on Restore/Discard/replacement is enough to use the increment
without a pointer. A duplicated full a11y/narrow/reduced-motion browser
gauntlet was later deleted as a Gate H closer.

## Scope

Gate H was later deleted as a closer. Gate I closed the user goal and records;
no Gates G–I remain pending.

Gate G is closed.
