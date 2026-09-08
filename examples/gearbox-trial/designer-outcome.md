# Outcome

Completed two native assemblies and nine per-part AP242 STEP exports through public real-stdio CAD calls. Final fresh-process reopen passed; the 360° input command produced −117° absolute output, corresponding to −120° travel from its 3° phase. All 18 recorded native gear poses pass transform/axis/center checks. Final assembly: 8 useful definitions, 15 instances.

20/40→20/60 teeth, module 1.5 mm, pressure angle 20°, face 10 mm, 8.1 mm gear bores, 8 mm shafts, 8.3 mm journals, 45→60 mm centers.

All 8 exact OCCT volumes match independent values within 1e-7 mm³. 361 authored-polygon poses per ratio had no boundary crossings; theoretical contact ratios are 1.635/1.671. Maximum sampled involute chord error: 0.004145 mm. These are geometric/kinematic checks; no continuous OCCT contact/interference or loaded mechanical validation.

Main workarounds: untyped addLine probe; wire extrude instead of complexity-limited region; typed Hole instead of unsupported cut-extrude; square-head-first bolt instead of circle-on-circle add; replace extrusion profiles instead of undocumented sketch update contracts.

Unmet physical requirements: gear/shaft torque and axial retention, real bearing fits, threads/nuts, root fillets, manufacturing and load validation. Native health remains unsupported with 14 issues (under-defined sketches and unproven wire topology correspondence). Tooth count/module/center edits require coordinated replay; native scalar changes alone do not rebuild the gear outline or move numeric joint frames. A supplied SVG/HTML inspection drawing has no browser visual QA because file URL navigation was policy-blocked. No policy workaround was attempted.

Measured cost including failed probes/retries: **151 tool calls**, 165 logged requests including initialize, **7 rejected requests**, **1.681 MB request / 48.821 MB response payloads**, **376.8 s** summed request time. Largest request 399.1 kB; 34 project_structure calls alone returned 39.811 MB. These byte counts exclude JSON-RPC id/version/newline framing. Discovery adds about 123 kB response data.

Read README.md for artifact names, limitations and replay commands; JOURNAL.md for concrete failure evidence; call-cost-summary.json for breakdown. Raw logs and exact authored batches are retained. No product code, repository examples or development history were read, and no commits/pushes were made.
