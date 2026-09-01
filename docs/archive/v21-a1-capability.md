# V21 A1 Named STEP Capability Evidence

Recorded: **2026-08-01**  
Implementation commit: `4b333544b75354fc3a2f9b101d55f770604f60b4`

## Result

The locked `opencascade.js` full browser bundle already exposes the B-rep,
XDE, STEPCAF, AP242, unit, Unicode-name, and cleanup bindings required by V21.
No OCCT binding or WASM build change was needed.

The production geometry worker wrote a box and cylinder as one AP242 STEP
artifact for each document unit. Both products intentionally used the duplicate
Unicode name `Bracket Ω`. The same OCCT instance then verified the result using:

- `STEPControl_Reader.StepModel()` and `APIHeaderSection_MakeHeader` for the
  parsed schema identifier;
- `STEPControl_Reader.FileUnits()` for authoritative length units;
- STEPCAF/XDE free-shape labels and `TDataStd_Name` equality for body count,
  non-null shapes, and names; and
- `BRepTools.Write` plus `BRepTools.Read` for the B-rep checkpoint path.

This proof does not use STEP text substring checks.

| Unit | Reader unit | Bodies/shapes | Names | STEP bytes | B-rep bytes |
| --- | --- | ---: | --- | ---: | ---: |
| `mm` | `millimetre` | 2 / 2 | `Bracket Ω`, `Bracket Ω` | 20,515 | 2,490 |
| `cm` | `centimetre` | 2 / 2 | `Bracket Ω`, `Bracket Ω` | 20,579 | 2,490 |
| `m` | `metre` | 2 / 2 | `Bracket Ω`, `Bracket Ω` | 20,759 | 2,490 |
| `in` | `INCH` | 2 / 2 | `Bracket Ω`, `Bracket Ω` | 21,794 | 2,490 |

Every file reported schema `AP242DIS`; its parsed schema identifier began with
`AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF`. Temporary STEP/B-rep files,
documents, labels, handles, builders, readers, and writers are released on both
success and failure paths.

## Browser and bundle evidence

`pnpm build:geometry-worker` followed by
`PARTBENCH_SMOKE_BROWSER_NO_SANDBOX=1 node scripts/smoke-occt-browser.mjs`
passed in `HeadlessChrome/151.0.7922.34`. The persisted
`.metrics/occt-browser.jsonl` row names the implementation commit above and
records worker startup and WASM load as successful.

| Asset | A0 gzip bytes | A1 gzip bytes | Delta | Cap |
| --- | ---: | ---: | ---: | ---: |
| OCCT WASM | 13,808,536 | 13,808,536 | 0 | 13,808,536 |
| Geometry worker | 84,725 | 85,246 | +521 | 122,880 |

The A1 geometry worker is 376,763 bytes raw. The OCCT WASM is 50,305,130 bytes
raw and 11,193,695 bytes Brotli; the browser received the Brotli artifact.

## Checks

- `pnpm --filter @web-cad/occt-wasm test` — 107 passed, including the real
  four-unit round trip and exhaustive missing-binding diagnostics.
- `pnpm --filter @web-cad/geometry-kernel test` — 87 passed.
- `pnpm --filter @web-cad/geometry-worker test` — 55 passed.
- Touched package and web typechecks passed.
- `scripts/occt-smoke/records.test.mjs` — 4 passed.
- Prettier and `git diff --check` passed.
- The post-commit real-browser smoke passed at the implementation SHA.

The smoke harness also now treats polling before `<body>` creation as pending,
so an early navigation poll cannot mask an application or worker failure.
