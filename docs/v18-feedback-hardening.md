# V18 Persona Feedback Hardening

Date: 2026-07-20

This maintenance record distills the five 2026-07-19 persona reports into
shared issues. It does not extend the V17 modeling matrix or introduce new CAD
protocol, document, geometry, renderer, or storage behavior.

## Verified issues and disposition

| Issue | Root cause and scope | Disposition |
| --- | --- | --- |
| Revolve and Sweep commit but render no solid in a plain production build | The production Vite build compiled in the disabled derived-geometry runtime unless `VITE_ENABLE_DERIVED_GEOMETRY=true` was supplied. The command records were valid; the missing display affected every authored family without a primitive fallback. | Fixed globally: supported derived geometry is enabled by default for serve and build. `VITE_DISABLE_DERIVED_GEOMETRY=true` remains the explicit fallback diagnostic. |
| Footer says `Ready` when results are pending, failed, unavailable, or compiled out | The Solid footer used command idleness alone. | Fixed with one frontend result-state projection that composes command, derived-result, and project-health state. |
| Successful Apply leaves a create editor dirty and ready to apply again | The editor reset its local phase after `onApply`, while the App retained the active tool. The command helper also returned structured errors rather than throwing them to the editor. | Fixed: a create editor closes only after a successful commit; a failed or non-committing apply remains open with an error. |
| Quick Box/Cylinder accepts a Z value that has no effect | These quick actions intentionally author an XY sketch plus symmetric extrude. Their plan used X/Y for the profile center and discarded Z. Supporting Z would require an additional plane or transform capability. | Deleted the misleading Z field from quick Box/Cylinder creation and explained the Top-plane constraint. Legacy primitive edits and primitives whose commands honor XYZ retain Z. |
| Normal generated sketches and their bodies all look broken | Tree health projected normal `under-defined` sketch freedom as warning badges on the sketch, feature, and body. | Fixed: the history tree reserves alarm badges for actionable health failures. Project health calls under-definition “design notes”; Sketch mode retains detailed solver information. |
| Selection guidance contradicts a valid selected target | The shared collector always rendered an imperative empty-state sentence. | Fixed: a populated collector says what kind it accepts; empty/collecting state asks the user to select it. |
| Fillet/Chamfer and Shell do not coach the required pick kind | Actions opened the editor without changing the global selection filter. | Fixed: edge finishes activate Edge selection and Shell activates Face selection, with an explicit next-step notice. |
| Body-only patterns look like feature patterns | The labels used common feature-pattern terminology even though the existing commands accept result bodies only. | Fixed by naming the actions and editors `Linear Body Pattern` and `Circular Body Pattern`, with body-seed guidance. |
| Tree names are repetitive and truncated | Quick bodies reused `Box`/`Cylinder`, and a nested result repeated its owning feature name. Ellipsized labels had no native disclosure. | Fixed: quick names are numbered, a same-named nested body is labeled `Result`, and full labels/details have tooltips. |
| Command search is noisy for “Create sketch” | The registered action label was only `Sketch`; equally relevant results used registry order without current-mode/readiness context. | Fixed: the action is `Create Sketch`, and equal-quality matches prefer ready actions in the current mode. |
| Sweep paths and revolve axes are hard to distinguish | Forward/reverse path candidates had generic numbered labels and axes did not identify construction intent. | Fixed: path labels expose curve/chain type and direction; construction-line axes are labeled explicitly. |
| Loft is prominent without an offset-plane command | V17 Loft supports ordered profiles on parallel planes, but V18 cannot invent a construction-plane feature. Existing attached sketches can provide a parallel section on a supported planar body face. | Kept within the compatibility matrix: the editor preserves source labels and order and explains the supported face-attached workflow. No offset-plane capability was added. |
| Viewport repeats ordinary selection warnings | Both the compact viewport badge and contextual strip rendered the same selection state. | Fixed: ordinary selection guidance stays in the contextual strip; the compact badge is reserved for stale references and pending/failed display geometry. |
| Stable-reference warning reads like a failed solid | The diagnostic exposed downstream-reference readiness as if it were result readiness and included internal body IDs. | Fixed copy distinguishes a complete solid from faces/edges unavailable to downstream tools and removes internal IDs. |

## Requests outside V18 maintenance scope

Feature patterns, boolean union, construction/offset planes, a new preview
protocol, broader face/edge reference support, and new shaded-renderer behavior
would expand the completed V17/V18 matrices or cross the renderer/geometry
boundary. They were not implemented in this maintenance pass. The UI now names
the narrower supported behavior and gives a valid existing-workflow next step
where one exists.

## Verification

- Focused frontend regression suite covering flags, result state, editor fields,
  collectors, search, tree health/naming, viewport status, and visible copy.
- Default production web build, including the browser geometry worker and OCCT
  WASM assets without an enable flag.
- V17 composite-feature release workflow, including Revolve.
- V17 curved-sweep release workflow.
- Full repository typecheck and lint.

The built-app CDP smoke additionally requires a local Chromium-compatible
binary. When no such binary is installed, the release-sample and production
bundle checks above remain deterministic, but the browser interaction pass must
be run in an environment that supplies `PARTBENCH_SMOKE_BROWSER`.
