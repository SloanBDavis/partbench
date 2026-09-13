# Independent engine import observations

## Source and scope

I selected the publicly downloadable Radial Engine.STEP from SivakumarThirumurugan/Radial-Engine, pinned at e7ef4673a68cfda8bdc55961d82e9dd1401c672a. The repository describes a complete multi-cylinder SolidWorks radial-engine assembly. The author's reference image shows a five-cylinder radial assembly with finned cylinder housings, crankcase, cylinder heads, push rods and pipes. This was downloaded unmodified, not created for Partbench.

Source page: https://github.com/SivakumarThirumurugan/Radial-Engine

Pinned download: https://raw.githubusercontent.com/SivakumarThirumurugan/Radial-Engine/e7ef4673a68cfda8bdc55961d82e9dd1401c672a/Radial%20Engine.STEP

File: radial-engine.step, 13,389,913 bytes. SHA-256: 50e2d7946e1ebed4848549798cdaefddb5c3e8fb7f4f625c06358f4a8c0aebc0. Header identifies STEP AP214 (AUTOMOTIVE_DESIGN), SolidWorks 2025, source timestamp 2026-01-05T16:41:31. Source metadata, HTTP headers and README are saved beside this report. The repository contains a LICENSE file; I fetched and verified its text as MIT with copyright (c) 2026 Sivakumar Thirumurugan. It is saved as source-LICENSE. The STEP and images remain in ignored .metrics and were not committed or redistributed.

## Method

Read AGENTS.md, docs/how-we-work.md, docs/verification.md and docs/skills/ui-smoke.md, then used scripts/smoke-ui.mjs with Bun's forced Chrome backend. The existing runner initially only accepted a WCAD file fixture; I reported the obstacle to root, which added a minimal importStep step to that same runner. The fixture supplies the local file to showOpenFilePicker and the runner clicks the real Project then Import STEP controls. It records and accepts the application preview confirmation; product import/geometry code is unchanged.

The planned journey is the full unmodified engine import, Fit All, isometric/front/top/right screenshots, and selecting a body. These later actions must not be claimed if import fails. trial.json records them. A separate single-solid shaft import exercises the runner success branch as a harness control, not as an engine substitute.

## Sourcing obstacles

The smaller Marathon V6 candidate advertised a STEP download but its URL returned an HTML library webpage. I saved that failed response as candidate-download-returned-html.html and did not import it. OCCT public sample files only provided connecting rods rather than a complete engine. STEP Tools' 101 MB Ai-14R engine was a viable larger fallback, but the 13.4 MB radial engine met the complete assembly request with a moderate file size.

## Browser result

The original engine import failed naturally after 168,747 ms of measured import wall time (about 2 min 49 sec), before reaching the preview confirmation. This was not a timeout. The runner recorded `preview: null`, exited 1 and reported `ui-use passed 0/1 Chromium (not WebKit)` using HeadlessChrome/153.0.0.0.

Exact on-screen error: **STEP import produced 266 bodies, exceeding the maxBodyCount of 1.**

I opened and visually inspected engine-import-failure.png. The app remains on Project → Files; a red error bar contains that message. The STEP import card also says “Unavailable” and “STEP import is typed but unavailable until the geometry worker exposes a STEP reader.” That explanatory text conflicts with the import having actually parsed enough geometry to report 266 bodies. No engine appeared. Fit, orthographic views and component selection were not reached, and cannot be assessed from this run.

The source was not split, fused, filtered or otherwise changed to obtain a pass. Root ran an independent direct-kernel check concurrently, so 168.7 seconds is a diagnostic wall time, not an isolated performance benchmark. Raw browser output is browser-run.log.

## Separate harness control

The pre-existing single-solid shaft STEP fixture imported through the same file-picker and preview path. The preview reported one body, one evidence record and bounds 8 × 8 × 20 mm. Import elapsed wall time was 2,596 ms in the final complete control (2,330, 2,333 and 2,578 ms in prior attempts while correcting the control steps). The real application proceeded through Building exact results to Ready, with body_1 ready and display ready. These are harness controls, not engine imports.

I visually inspected the isometric, front, top, right and selected screenshots. The model is a single cylinder, centered and fully within the viewport after Fit All. The orthographic views change as expected (top circle, front/right elongated cylinder), and selecting the Result row highlights the body in green. These prove the helper supplies readable STEP bytes and the positive import/render path works for one solid.

The final control journey passed 1/1 in 5.9 seconds, including visible import, fit, views, selection and invalid-file rejection. The earlier control attempts were not wholly green, for the following recorded test-authoring reasons. In the first attempt, I tried to select the Result body before expanding its imported-feature parent; the body selector was absent. I preserved harness-control-first.json and harness-control-first.log, then corrected that interaction by clicking Expand shaft. The second attempt reached the selected-body screenshot successfully. Its later fresh empty-selection break failed because my test assumed Fit selected should have the native disabled attribute. Root reviewed the action implementation and identified that this needs-selection control intentionally remains enabled, exposing data-availability rather than native disabled. That is an incorrect test assumption, not evidence of a product defect. The initial screenshot and log are preserved as harness-control-incorrect-disabled-expectation.png and harness-control-second.log. No freeze or geometry corruption was observed. I replaced the unrelated selection negative case with an invalid STEP-file rejection, retaining the failed control records; no product behavior was changed. The third run imported the shaft in 2,578 ms and rejected the invalid file in 1,863 ms with the expected reader error. Its negative test still failed because the new runner helper reused an assertion that incorrectly equates the expected Update failed state with a freeze. The browser responded to state reads and screenshot capture. Root corrected that helper assertion to check a matching import error, commandPending=false and a successful hook evaluation within 5 seconds. The fourth/final control run passed, with shaft import taking 2,596 ms and invalid-file rejection taking 1,878 ms. I visually inspected its final selected-body and invalid-file screenshots. The invalid-file error is “Open CASCADE STEP reader could not read the file.” The application remained responsive after rejecting it.

## Verdict

**This complete engine assembly cannot currently be imported and rendered through Partbench's UI.** The original unmodified engine trial stopped before preview because the importer produced 266 bodies while the UI requested a maximum of one. Multi-view engine fidelity, component selection and assembly structure preservation remain untested because there was no engine in the document. The separate single-solid import proves the browser fixture and basic STEP rendering path work, but it does not reduce that engine failure.

Root separately reports the unchanged engine can be parsed by the direct OCCT boundary and returns a compound containing 266 solids; those detailed diagnostics live in kernel-diagnostic.json and were not my browser observations.

## Reproduction and evidence

- Engine: `bun scripts/smoke-ui.mjs --use .metrics/engine-step-trial/trial.json` (exit 1; 0/1).
- Harness control: `bun scripts/smoke-ui.mjs --use .metrics/engine-step-trial/harness-control.json` (final positive import/views/selection plus invalid-file rejection passed; exit 0; 1/1 in 5.9 seconds).
- Browser source/app: actual Vite workbench with `?ui-smoke=1`, existing forced Bun Chrome backend, HeadlessChrome/153.0.0.0.
- Raw engine output: browser-run.log. Source/hash: source.json. Engine screenshot: engine-import-failure.png. Author reference: source-reference.png.
- Control logs: harness-control-first.log, harness-control-second.log, harness-control-third.log and final harness-control.log. Control screenshots: engine-step-harness-control-isometric.png, -front.png, -top.png, -right.png, -selected.png; -invalid-file.png shows the successful negative control. harness-control-incorrect-disabled-expectation.png preserves the discarded selection-test assumption.
- No product code changed by this agent; no commits or pushes. Root owns the small runner extension and documentation updates.
