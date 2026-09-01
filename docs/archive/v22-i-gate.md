# V22 Gate I Evidence

Status: **Passed (2026-08-31).**

Gate I closes the V22 user goal and reconciles the release records at product
SHA `64ed45c`. Gate G was already closed and was not reopened. No package code
changed for this close.

## Kept

- DoD 1-16 and 21-22;
- keyboard-complete C-G product paths;
- empty-project and ordinary-sketch OCCT/worker/OPFS startup deferral;
- no private identifiers in visible or accessible UI; and
- truthful exact selection/measurement behavior with no approximate solid-pick
  default.

## Deleted requirements

- Gate H as a separate closer;
- a browser gauntlet, duplicated accessibility gauntlet, and gzip tripwires;
- the unused browser-workflow and performance named closers;
- a new Playwright suite, smoke runner, or named command; and
- replaying historical V7-V21.1 gauntlets as the Gate I closer.

Bundle checking remains informational only. There is no gzip or browser
gauntlet remaining work.

## Product smoke history

The four product smokes remain passed slice-closure history and were not rerun
for this docs-only Gate I close:

exact-selection, preview-grips, inspection, and recovery product smokes.

No new named command was added.

## Running-app evidence

This session started the real Vite app and drove Chromium against it.

Observed in this session:
- Empty project loaded as Untitled project with Model 0 / No model and no recovery prompt. No OCCT/WASM resource request appeared.
- Solid Box opened Create Box with Width/Height/Depth 10 mm and Ready to apply.
- Headless Chromium Apply showed CAD command worker failed, so this session did not re-commit a box.
- Visible copy had no OPFS names, file handles, or raw hashes.

The committed-box user-goal path was already demonstrated on this product SHA in Gate G Chromium: Box then Crash recovery Current, Restore/Discard without auto-replace, New Save/Discard/Cancel, and dirty beforeunload. Selection, preview/grips, and inspection remain closed by the four product smokes as history, not rerun here.

## Honest leftover

- A live tab kill during createWritable, before close/publish, was not forced. Orphan cleanup remains in the Gate G store test.
- This session did not re-prove Box Apply in headed Chromium after the headless worker error. Gate G already proved that path on the same product SHA.

V22 status is Completed. Gate H is deleted as a closer. No Gates G-I remain pending.
