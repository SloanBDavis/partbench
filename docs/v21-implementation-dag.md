# V21 Implementation DAG: Production Single-Part Reliability and Exact Interchange

Status: **Approved for implementation (2026-08-01). Slice A is in progress.**

This document turns `docs/v21.md` into a reviewable implementation sequence.
The release plan is authoritative for scope and semantics. This DAG is
authoritative for dependencies, slice gates, evidence, and landing order.

V21 has no Stretch work. A node may be split into smaller commits, but its gate
cannot be weakened or deferred. If real OCCT evidence contradicts the plan,
stop at the current gate and amend `docs/v21.md` with explicit approval.

## Working Rules

1. Land slices A-I in order on `main`; do not maintain a parallel PR stack
   across the shared protocol, exact-source, worker, and app boundaries.
2. Keep the worktree buildable and focused tests green after every node.
3. A geometry implementation is not complete until its protocol validation,
   app resolution, exact metadata/topology, STEP, failure, and cleanup checks
   are green.
4. No source feature is marked STEP-ready until real browser OCCT proof exists.
5. Cad-core remains the eligibility authority; successful OCCT execution cannot
   expand a completed modeling support matrix.
6. Derived artifacts and output bytes never enter document source, history,
   redo, JSON, canonical CBOR, `.wcad`, or MCP responses.
7. Reuse existing helpers first. Delete superseded production mapping code once
   compatibility tests prove it is unused.
8. Each gate records commands, measurements, unresolved findings, and the exact
   commit that passed it in this document during implementation.

## Dependency Graph

```text
A0 baseline ─┬─> A1 OCCT name/unit capability ─┐
             └─> A2 exhaustive body matrix ────┴─> Gate A

Gate A ─> B1 protocol plan ─> B2 validators ─> B3 cad-core planning
                                      ├───────> B4 health/readiness
                                      └───────> B5 adapter projections ─> Gate B

Gate B ─> C1 canonical resolver shell
             ├─> C2 primitives
             ├─> C3 authored feature families
             ├─> C4 imported/checkpoint leaves
             └─> C5 graph limits + C6 identities ─> Gate C

Gate C ─> D1 artifact contracts ─> D2 same-shape OCCT build
                                  ├─> D3 bytes/hash/transfer/limits
                                  ├─> D4 checkpoint reuse
                                  └─> D5 failure/cleanup ─> Gate D

Gate D ─> E1 artifact-only STEP writer ─> E2 names/XDE
                                          ├─> E3 units/order/multi-body
                                          ├─> E4 browser orchestration
                                          └─> E5 remove production base64/
                                              recipe path ─> Gate E

Gate E ─> F1 shared exact-result state
             ├─> F2 display parity
             ├─> F3 topology/metadata/mass parity
             ├─> F4 selection/measurement parity
             └─> F5 health/export parity ─> Gate F

Gate F ─> G1 save/open rebuild ─> G2 edit/undo/redo staleness
                                 ├─> G3 project replacement/import
                                 ├─> G4 cancel/retry/worker restart
                                 └─> G5 persistence audit ─> Gate G

Gate G ─> H1 Project/File workflow ─> H2 accessibility/responsive
                                     ├─> H3 agent/MCP readiness
                                     └─> H4 V20 security/approval ─> Gate H

Gate H ─> I1 corpus/scripts ─> I2 real-browser round trips
                              ├─> I3 performance/bundle
                              ├─> I4 adversarial failures
                              └─> I5 compatibility/docs ─> Gate I / release
```

Dependencies within a slice show the earliest legal start. Gate acceptance
still waits for every node in the slice.

## Slice A — Capability Proof, Baselines, and Frozen Matrix

Goal: remove environmental and scope uncertainty before changing public
contracts.

### A0 — Record the Clean V20 Baseline

Required work:

- run repository-wide test, typecheck, lint, format, and build;
- run the three V20 release commands and eight V19 compatibility commands;
- record current critical/all-UI/worker/WASM bundle sizes;
- record current exact-export browser behavior and output size for the existing
  extrude/revolve/sweep sample;
- record current test count, documented skips, warnings, and browser version;
- verify the worktree is clean before implementation; and
- add no behavior change.

Evidence:

- committed baseline JSON/Markdown under the existing metrics conventions;
- exact command output referenced in the Gate A ledger; and
- failures classified as pre-existing or fixed before A1/A2.

### A1 — Prove Named AP242 and Unit Capabilities in Real Browser WASM

Required work:

- probe existing STEP writer, B-rep writer/read, AP242, unit, document/XDE,
  product-name, Unicode-name, and cleanup bindings;
- write two named exact bodies with duplicate and Unicode name cases;
- re-read the result through an XDE-capable or equivalently authoritative test
  path and verify names, units, body count, and non-null shapes;
- exercise `mm`, `cm`, `m`, and `in`;
- prove missing-binding diagnostics; and
- if required bindings are absent, add only the smallest binding surface inside
  `packages/occt-wasm`, measure its gzip delta, keep it within the V21 cap, and
  rerun the real-browser name/unit proof against that production build.

The node cannot pass using STEP text substring checks alone. The proof must use
real OCCT product/shape metadata or a standards-aware reader path already
within the approved geometry boundary. Gate A cannot pass with a proposed
binding list or mock-only proof.

### A2 — Freeze the Exhaustive Body/Consumer Fixture Matrix

Required work:

- enumerate every `CadBodySource["type"]` and active feature family;
- map each to completed V12-V19 modeling rows;
- identify active, consumed, unsupported, stale, repair-needed, failed, and
  missing-checkpoint cases;
- create deterministic fixtures for every Must row in `docs/v21.md`;
- identify imported-body downstream paths accepted by current cad-core;
- capture expected body/solid counts, units, names, bounds, volume, area,
  centroid, inertia, and topology counts; and
- add a compile/runtime audit that fails when a body source lacks policy.

### Gate A

Gate A passes only when:

1. the V20 baseline is green or every pre-existing failure is resolved;
2. real browser WASM proves a viable named AP242/unit path;
3. any OCCT binding change is bounded and explicitly recorded;
4. every current body source and completed support row has a fixture/policy;
5. no V21 Must row is demoted; and
6. no implementation beyond capability probes and test fixtures has landed.

Gate ledger:

- A0 complete at `a40d3b7f2ed491a0d8f6aa3c6fe7394fd4dea8bd` with the committed
  [V21 A0 baseline](./v21-a0-baseline.md).
- A1 pending.
- A2 pending.

## Slice B — Protocol and Cad-Core Export Planning

Goal: make public readiness and planning complete without geometry bytes.

### B1 — Add Additive Plan and Status Types

Required work:

- add `CadExactExportPlan`, ordered per-body plan entries, plan identity,
  current exact-result status, and diagnostic shapes;
- expand export source-kind vocabulary to classify every current body family;
- keep old requests and response members readable;
- keep artifact bytes out of public evidence and adapter schemas; and
- document deprecated compatibility-only export recipe/artifact fields.

Tests cover type construction, exhaustive unions, readonly shapes, and backward
compatible old response parsing.

### B2 — Validate Trust-Boundary Inputs

Required work:

- reject duplicate/missing/malformed body IDs and over-limit selections;
- validate source/body identities, plan identity, units, schema, counts, status,
  diagnostics, and bounded derived evidence;
- reject renderer, mesh, OCCT, worker, OPFS, path, handle, or byte fields in
  public evidence; and
- retain historical command/diff validators byte/shape compatible.

### B3 — Implement Deterministic Cad-Core Planning

Required work:

- select all active bodies for omitted/empty filters;
- preserve explicit body order;
- exclude consumed bodies from Export all and block them when explicitly
  requested;
- make explicit selection all-or-nothing;
- block Export all when any active selected body is not exact-ready;
- generate deterministic body-name fallback and plan identity;
- bind project and body source identities; and
- return no geometry recipe or file bytes as V21 authority.

Tests include reordered maps, duplicate names, Unicode names, history-only
identity changes, and mixed ready/blocked projects.

### B4 — Make Health and Readiness Exhaustive

Required work:

- add primitive, sweep, loft, linear/circular pattern, mirror, imported-body,
  and any other missing family to project-health coverage;
- map matching/missing/stale/failed derived evidence consistently;
- align `project.summary`, `project.health`, `project.exportReadiness`, and
  `project.exportExact`; and
- retain all existing health fields additively.

### B5 — Project Metadata Through Agent and MCP Adapters

Required work:

- expose plan/readiness metadata and diagnostics;
- prove responses contain no B-rep/STEP bytes, handles, paths, renderer IDs, or
  cache IDs;
- keep in-memory adapters honest when browser exact evidence is absent; and
- leave V20 approval and transport behavior unchanged.

### Gate B

Gate B passes only when protocol, cad-core, agent-adapter, MCP-adapter, and
stdio tests prove every plan/health row, old requests still pass, and no
geometry or browser implementation is required to evaluate source eligibility.

## Slice C — Canonical Current Exact-Body Resolver

Goal: resolve every active supported body once at the app/geometry boundary.

### C1 — Establish the Resolver and Exhaustive Policy Map

Required work:

- replace scattered export-specific source discovery with one resolver;
- use the frozen A2 policy map and an exhaustive `satisfies` check;
- separate cad-core eligibility from exact source construction;
- return one bounded ready/pending/stale/blocked/failed/unsupported result; and
- keep current display/exact services operational during migration.

### C2 — Resolve Primitive Exact Sources

Required work:

- map box, cylinder, sphere, cone, and torus compatibility bodies to their
  current exact OCCT sources;
- apply document transforms/units consistently;
- prove exact metadata and source identity; and
- do not convert primitives into authored feature source.

### C3 — Resolve Every Authored Feature Family

Required work:

- extrude entity/wire/regions and supported add/cut chains;
- revolve entity/wire/regions in completed modes;
- line/arc/G1 sweep and supported loft;
- hole, chamfer, fillet;
- linear/circular pattern, mirror, shell under the V16 seed matrix; and
- existing generated/reference placement frames.

Each mapping reuses current `DerivedExactMetadataSource`/runtime helpers or
deletes/replaces duplication. Tests compare old and canonical sources for
currently green rows before deleting production use of old export mappers.

### C4 — Resolve Imported and Checkpoint-Backed Sources

Required work:

- validate imported feature/checkpoint/payload correspondence;
- validate B-rep byte length/hash before exact use;
- resolve standalone imported bodies;
- permit verified B-rep leaves only for completed imported downstream
  add/cut/hole/edge-finish paths;
- block missing/stale/repair-needed/corrupt evidence; and
- prove internal B-rep support does not widen cad-core commandability.

### C5 — Bound Graph Traversal

Required work:

- detect cycles;
- count exact source nodes;
- enforce the 4,096-node cap;
- reject duplicate semantic ownership and invalid target/tool graphs;
- avoid recursive stack overflow through iterative traversal where needed; and
- produce deterministic diagnostics and ordering.

### C6 — Bind Cache and Body Identity

Required work:

- include all geometry-affecting source fields in the canonical cache key;
- hash cache identity with existing SHA-256 facilities;
- bind current body topology/source identity;
- use checkpoint hash rather than byte length alone for imported sources; and
- prove edit/undo/redo/repair/load invalidation.

### Gate C

Gate C passes only when every A2 ready fixture resolves exactly once, every
blocked fixture stays blocked, no completed modeling row changes eligibility,
and current display/exact metadata compatibility tests remain green.

## Slice D — Identity-Bound Exact Body Artifacts

Goal: materialize one trustworthy transient artifact from one exact OCCT shape.

### D1 — Add Internal Artifact Requests and Responses

Required work:

- geometry-kernel/worker artifact types and request factory;
- body/project/cache identities;
- B-rep bytes/length/hash;
- exact metadata/topology/generated references;
- transferables and structured diagnostics; and
- strict resource validation.

No artifact type is added to project source or MCP payloads.

### D2 — Build Every Artifact From One Shape Lifetime

Required work:

- route all exact source kinds through `withOcctExactBodyShape` or its direct
  replacement;
- compute metadata and topology from that shape;
- serialize that same shape;
- preserve wire-extrude generated references;
- require a non-null valid shape and completed solid policy; and
- cover every matrix row through real OCCT.

### D3 — Hash, Transfer, and Enforce Limits

Required work:

- hash source cache key and B-rep bytes;
- validate transferred byte ownership and detached-buffer behavior;
- enforce 128 MiB per body and 512 MiB aggregate orchestration limits;
- avoid main-thread hashing/base64; and
- release retained artifact memory deterministically.

### D4 — Reuse the Artifact in Explicit Checkpoint Generation

Required work:

- refactor explicit checkpoint payload creation onto the shared artifact
  builder;
- preserve checkpoint ID/body/feature/source semantics and exact serialized
  package bytes;
- avoid auto-creating checkpoint source records; and
- pass V13-V19 `.wcad` compatibility tests.

### D5 — Prove Failure Cleanup

Required work:

- inject every builder/read/write/topology/hash failure;
- verify OCCT handles and virtual files are cleaned up;
- verify no partial artifact or detached buffer is retained;
- verify cancellation/disposal behavior; and
- verify corrupt imported B-rep remains isolated in WASM.

### Gate D

Gate D passes only when all body matrix fixtures produce internally consistent
artifacts, all faults are atomic and leak-free, and checkpoint compatibility is
byte/shape correct.

## Slice E — Named AP242 Writer and Browser Execution

Goal: write exact STEP from artifacts without rebuilding feature recipes.

### E1 — Replace Production Writer Input With Artifacts

Required work:

- validate artifact IDs, lengths, hashes, formats, and plan order;
- read B-rep bytes into non-null shapes;
- transfer each shape exactly once;
- release parsed shapes after transfer;
- write one non-empty AP242 artifact; and
- return bytes as a transferable.

### E2 — Preserve Body Names

Required work:

- use the A1-proven XDE/STEPCAF or equivalent named-product path;
- preserve duplicate and Unicode names;
- apply deterministic body-ID fallback for empty names;
- report named-writer capability separately from basic writer capability; and
- block production output when required name support is unavailable.

### E3 — Preserve Units, Order, and Multi-Solid Shapes

Required work:

- write all four document units;
- preserve selected body order in product creation;
- transfer compounds/multi-solid pattern results as one selected body shape;
- enforce 256-body and 512 MiB output limits; and
- prove selected, ordered multi-body, and Export-all semantics.

### E4 — Orchestrate Plan, Artifacts, Write, and Final Identity

Required work:

- capture source identity;
- obtain plan;
- resolve and identity-check bodies;
- build one artifact per selected body;
- execute STEP write;
- re-check project/body identities; and
- produce a Blob/download only for a current result.

Every async boundary has a stale/cancel/failure test.

### E5 — Remove the Production Base64 and Recipe Path

Required work:

- download worker bytes directly through `Blob`;
- remove production base64 encode/decode and avoid duplicate buffers;
- stop production use of export-only extrude/revolve/sweep mappers;
- retain old public shapes only for compatibility; and
- delete dead mapping code/tests that no supported caller needs.

### Gate E

Gate E passes only when every V21 matrix row writes named/unit-correct AP242
through artifacts, explicit failure/stale/cancel paths create no download, and
the production browser path contains no STEP base64 conversion or feature
recipe writer input.

## Slice F — Cross-Consumer Exact-Result Parity

Goal: make every product surface report the same body truth.

### F1 — Add One Shared Exact-Result Projection

Required work:

- compose lifecycle/dependency, display, exact source/metadata, topology,
  checkpoint, and export job evidence;
- return the bounded V21 status vocabulary;
- enforce the binding blocker/build/stale/terminal precedence from
  `docs/v21.md`;
- bind every evidence item to current body identity; and
- provide one pure projection used by app consumers.

### F2 — Align Display State

Required work:

- never display an old mesh as current after exact-source invalidation;
- add missing display parity only for body rows already accepted by completed
  command matrices, including required imported downstream results;
- distinguish display failure from exact/export failure; and
- keep meshes derived and non-authoritative.

### F3 — Align Topology, Metadata, Mass, and Extents

Required work:

- use matching canonical exact source/body identities;
- cover all body families in project health and exact metadata;
- preserve existing topology confidence/repair semantics;
- align mass, inertia, bounds, area, centroid, and topology counts; and
- reject missing/stale evidence consistently.

### F4 — Align Selection and Measurement

Required work:

- selected body status matches Project/File and Inspect;
- body mass/measurement uses current exact evidence;
- existing generated/topology subentity measurement rows remain unchanged;
- selected export uses semantic body ID only; and
- no renderer/mesh/pixel authority leaks.

### F5 — Align Health and Export Diagnostics

Required work:

- project summary/health/export counts agree;
- per-body titles and next actions share root diagnostics;
- visible messages avoid internal milestone/OCCT/cache wording; and
- agent/browser projections agree when given the same evidence.

### Gate F

Gate F passes only when a table-driven cross-consumer test covers every matrix
row and every status, with no contradictory current/ready/blocked result.

## Slice G — Rebuild, History, Storage, and Concurrency Hardening

Goal: prove exact output remains honest through normal project lifecycle.

### G1 — Save/Open and Rebuild

Required work:

- `.wcad` preserves existing source/checkpoints and no V21 artifact;
- open rebuilds current exact sources/artifacts before export;
- JSON limitations for checkpoint-backed bodies remain explicit;
- minimum schema remains unchanged; and
- repeated save/open/export is deterministic in geometry and plan semantics.

### G2 — Edit, Undo, and Redo

Required work:

- upstream edits invalidate affected exact identities only;
- downstream blocked/repair states remain honest;
- undo/redo restore corresponding buildable results;
- artifact/job state never enters history; and
- agent/human actor metadata remains unchanged.

### G3 — New, Open, and Project Replacement

Required work:

- pending export settles as stale/cancelled;
- old artifacts and object URLs are released;
- no old project body can appear in a new plan; and
- failed replacement retains current source under existing storage semantics.

### G4 — Cancel, Retry, Disconnect, and Worker Restart

Required work:

- cancel guarantees no download;
- retry creates a new plan/generation;
- worker termination/recreation safely rebuilds derived state;
- out-of-order and disconnected responses cannot apply; and
- V20 relay disconnect behavior remains independent.

### G5 — Persistence Boundary Audit

Required work:

- inspect JSON, canonical CBOR, history, redo, `.wcad`, OPFS index, agent/MCP,
  and source hashes;
- prove no exact/export artifact, job ID, cache key, browser handle, or private
  geometry ID is persisted; and
- prove `.wcad` v2 authoritative checkpoint behavior remains unchanged.

### Gate G

Gate G passes only when lifecycle/concurrency/storage fault tests are green,
canonical source bytes are unaffected by export, and V1-V22 plus `.wcad` v2
round trips remain compatible.

## Slice H — Product UI and Connected Agent Parity

Goal: expose the complete result without adding authority or duplicate actions.

### H1 — Project/File Exact Export Workflow

Required work:

- Export all active bodies;
- Export selected semantic body;
- explicit ordered multi-body chooser;
- per-body readiness, AP242/unit/name summary, progress, Cancel, Retry, and
  technical diagnostics;
- all-or-nothing messaging and explicit subset re-plan; and
- direct bytes-to-Blob download with object URL cleanup.

### H2 — Accessibility, Focus, and Responsive Behavior

Required work:

- keyboard-only chooser and export;
- focus restoration after download/cancel/failure;
- accessible progress and error announcements;
- V18 Apply/Cancel/Escape and action ownership;
- narrow layout with no hidden blockers; and
- no internal diagnostic codes as the only user explanation.

### H3 — Connected Agent and MCP Readiness

Required work:

- expose complete body plan/readiness metadata;
- inject bounded current derived evidence in the connected browser path;
- keep in-memory behavior honest without a worker;
- prove no bytes/handles/paths/private IDs; and
- update tool schema/descriptions without adding a file-writing tool.

### H4 — Preserve V20 Security and Approval

Required work:

- exactly Manual approval and Approve everything;
- export planning creates no proposal;
- an approved agent edit stales an in-flight export correctly;
- relay token/origin/host/single-tab behavior remains green; and
- no transport, permission, network, script, or filesystem expansion.

### Gate H

Gate H passes only when the production browser workflow and connected MCP path
report the same readiness, all UI/accessibility contracts pass, and the V20
security/approval commands are unchanged and green.

## Slice I — Release Proof and Adversarial Review

Goal: demonstrate the release claim rather than infer it from unit coverage.

### I1 — Land the Corpus and Named Commands

Required work:

- implement all eight package scripts from `docs/v21.md`;
- commit deterministic source fixtures and expected invariant metadata;
- use real OCCT for exact artifact/export/round-trip scenarios; and
- keep release-level commands out of the default per-save loop.

### I2 — Run Real-Browser Round Trips

Required work:

- all seven normative scenarios;
- all body families, units, names, selected/multi-body order;
- imported downstream results;
- production build/worker/download path; and
- re-imported exact invariant comparison.

### I3 — Enforce Performance and Bundle Gates

Required work:

- inherited V19/V20 bundle caps;
- conditional V21 OCCT cap only when A1 required bindings;
- next-frame feedback, no >50 ms export main-thread tasks, no base64;
- body/graph/byte caps and retained-memory audit; and
- p50/p95 artifact, writer, total, byte-size, and restart metrics.

### I4 — Adversarial Failure Pass

Required work:

- every diagnostic/fault in `docs/v21.md`;
- source mutation at every async boundary;
- hash/length/corrupt/null failures;
- missing named writer and transfer/write failures;
- cancel/disconnect/termination/download failure;
- mixed ready/blocked and limit cases; and
- no mutation, partial output, leaks, stale application, or permission drift.

### I5 — Compatibility, Simplification, and Documentation

Required work:

- full V19/V20 compatibility suite and repository validation;
- delete unused production export recipe/base64 code;
- audit every body source and non-goal for partial exposure;
- reconcile README, AGENTS, architecture, implementation plan, native format,
  package docs, `docs/v21.md`, and this DAG;
- change plan status to Complete only after all evidence exists; and
- record exact test counts, timings, artifact hashes/sizes, bundle sizes,
  warnings, and known non-goals.

### Gate I / Release

Gate I passes only when all numbered V21 Must items, all named commands, full
validation, compatibility, adversarial review, documentation, and non-goal
audits are green. No deferred implementation item may remain behind a ready UI
claim.

## Gate Ledger

Update this table during implementation. “Not started” is the only valid state
before explicit plan approval.

| Gate | Status | Required evidence |
| --- | --- | --- |
| A | In progress | Baseline, named AP242/unit real-browser capability, exhaustive fixture matrix |
| B | Not started | Protocol/core plan, validation, health/readiness, adapter tests |
| C | Not started | Exhaustive current exact resolver and identity/limit tests |
| D | Not started | Same-shape artifact, checkpoint reuse, real OCCT/fault/cleanup proof |
| E | Not started | Artifact-only named/unit STEP, multi-body/stale/cancel, no production base64/recipe path |
| F | Not started | Cross-consumer exact-result parity table |
| G | Not started | Rebuild/history/storage/concurrency compatibility |
| H | Not started | Accessible browser workflow and V20-safe connected agent readiness |
| I | Not started | Corpus, named commands, performance/bundle, adversarial review, full validation/docs |

## Review Checklist

Before accepting any gate, reviewers answer yes to every applicable question:

- Does cad-core still decide product eligibility?
- Is the exact source current and identity-bound?
- Did real OCCT produce and re-read the artifact?
- Are metadata/topology/B-rep derived from one shape?
- Are every allocation, virtual file, buffer, URL, and job released?
- Can source change at this boundary, and is the result rejected if it does?
- Is the operation bounded and cancellable without source mutation?
- Does the body matrix include this source/consumer row?
- Do browser and agent surfaces report the same readiness?
- Are artifact bytes absent from source, storage, history, and MCP?
- Do old schemas, packages, commands, diffs, and V19/V20 workflows still pass?
- Did the change delete superseded duplication where safe?
- Is any V21 non-goal partially visible?

End of approved V21 implementation DAG.
