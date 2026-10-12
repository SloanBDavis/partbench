// Documentation integrity and navigation, not a product test runner.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, relative, isAbsolute, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(root, "docs/cad-feature-matrix.json");
const output = resolve(root, "docs/cad-feature-matrix.md");
const readmePath = resolve(root, "README.md");
const graphicPath = resolve(root, "docs/assets/cad-feature-matrix.svg");
const matrix = JSON.parse(readFileSync(input, "utf8"));
const args = process.argv.slice(2).filter((arg) => arg !== "--");
if (
  args.length > 1 ||
  args.some((arg) => !["--check", "--next"].includes(arg))
) {
  throw new Error("Usage: pnpm cad:matrix [--check | --next]");
}
const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};
const nonempty = (value) =>
  typeof value === "string" && value.trim().length > 0;
const localPath = (path) => {
  requireValue(nonempty(path), "Evidence/foundation path must be nonempty");
  const target = resolve(root, path);
  const rel = relative(root, target);
  requireValue(
    !rel.startsWith("..") && !isAbsolute(rel) && existsSync(target),
    `Missing or external repository path: ${path}`
  );
};
const unique = (items, label) => {
  requireValue(new Set(items).size === items.length, `Duplicate ${label}`);
};
requireValue(matrix.schemaVersion === 1, "Unsupported matrix schema");
requireValue(
  JSON.stringify(matrix.policy.statuses) === '["Done","Not done"]',
  "Only Done and Not done are permitted"
);
unique(
  matrix.categories.map((c) => c.id),
  "category IDs"
);
unique(
  matrix.features.map((f) => f.id),
  "feature IDs"
);
unique(matrix.frontier, "frontier IDs");
const categories = new Map(matrix.categories.map((c) => [c.id, c]));
const features = new Map(matrix.features.map((f) => [f.id, f]));
for (const [id, source] of Object.entries(matrix.sources)) {
  requireValue(
    nonempty(source.title) &&
      /^https:\/\//.test(source.url) &&
      /^\d{4}-\d{2}-\d{2}$/.test(source.accessed),
    `Invalid source ${id}`
  );
}
for (const category of matrix.categories) {
  requireValue(
    nonempty(category.title) &&
      Number.isInteger(category.priority) &&
      category.priority >= 0 &&
      category.priority <= 4,
    `Invalid category ${category.id}`
  );
  requireValue(
    category.sources.length > 0 &&
      category.sources.every((id) => matrix.sources[id]),
    `Missing catalog source for ${category.id}`
  );
  localPath(category.foundation);
}
for (const [id, proof] of Object.entries(matrix.evidence)) {
  requireValue(
    nonempty(proof.command) &&
      nonempty(proof.scope) &&
      nonempty(proof.sourceCommit) &&
      /^\d{4}-\d{2}-\d{2}$/.test(proof.date),
    `Incomplete evidence ${id}`
  );
  requireValue(
    proof.journeys.length > 0 && proof.records.length > 0,
    `Evidence ${id} requires a journey and a recorded result`
  );
  [...proof.journeys, ...proof.records].forEach(localPath);
}
const allowedFields = new Set([
  "id",
  "category",
  "feature",
  "done",
  "acceptance",
  "dependsOn",
  "evidence"
]);
for (const feature of matrix.features) {
  requireValue(
    Object.keys(feature).every((key) => allowedFields.has(key)),
    `Unknown field on ${feature.id}; completion must remain binary`
  );
  requireValue(
    /^[A-Z]+-\d{3}$/.test(feature.id) && categories.has(feature.category),
    `Invalid feature/category ${feature.id}`
  );
  requireValue(
    typeof feature.done === "boolean",
    `${feature.id}: done must be boolean`
  );
  requireValue(
    nonempty(feature.feature) && nonempty(feature.acceptance),
    `${feature.id}: missing feature/acceptance contract`
  );
  requireValue(
    Array.isArray(feature.dependsOn) && Array.isArray(feature.evidence),
    `${feature.id}: missing dependency/evidence arrays`
  );
  unique(feature.dependsOn, `${feature.id} prerequisites`);
  unique(feature.evidence, `${feature.id} evidence`);
  for (const id of feature.dependsOn) {
    requireValue(features.has(id), `${feature.id}: unknown prerequisite ${id}`);
    requireValue(
      !feature.done || features.get(id).done,
      `${feature.id}: Done depends on Not done ${id}`
    );
  }
  for (const id of feature.evidence)
    requireValue(matrix.evidence[id], `${feature.id}: unknown evidence ${id}`);
  requireValue(
    !feature.done || feature.evidence.length > 0,
    `${feature.id}: Done requires recorded E2E evidence`
  );
}
for (const id of matrix.frontier)
  requireValue(features.has(id), `Unknown frontier ID ${id}`);
const visited = new Set();
const visiting = new Set();
function visit(id) {
  requireValue(!visiting.has(id), `Dependency cycle at ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  features.get(id).dependsOn.forEach(visit);
  visiting.delete(id);
  visited.add(id);
}
features.forEach((_, id) => visit(id));
const status = (f) => (f.done ? "Done" : "Not done");
const cell = (value) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
const link = (path) => `[${path}](../${path})`;
const doneCount = matrix.features.filter((f) => f.done).length;
const lines = [
  "# Professional CAD feature matrix",
  "",
  "<!-- Generated by scripts/cad-matrix.mjs. Edit cad-feature-matrix.json, then run pnpm cad:matrix. -->",
  "",
  `Updated ${matrix.updated}; repository baseline \`${matrix.baselineCommit}\`.`,
  "",
  `**${matrix.features.length} feature contracts · ${matrix.categories.length} areas · ${doneCount} Done · ${matrix.features.length - doneCount} Not done.** These are inventory counts, not a percentage of professional CAD parity.`,
  "",
  matrix.policy.scope,
  "",
  "## Binary completion contract",
  "",
  matrix.policy.rule,
  "",
  matrix.policy.globalAcceptance,
  "",
  matrix.policy.evidencePolicy,
  "",
  "A foundation link identifies code worth reusing; it is not completion evidence. A catalog link establishes coverage context, not a claim that every listed product or subscription implements every row. Acceptance criteria are Partbench's proposed requirements.",
  "",
  "## How to hill climb",
  "",
  matrix.policy.selectionPolicy,
  "",
  "1. Run `pnpm cad:matrix --next` to inspect the ordered frontier and unmet prerequisites. Priority 0 is responsiveness; 1 is drawing/exchange foundations; 2 is daily-use mechanical/platform work; 3 is broader product design; 4 is specialist workflows. Priority is ordering, never completion status.",
  "2. Take the first useful dependency-ready contract, retain its full scope and implement through the shared document/geometry authority. Prefer a prerequisite that unlocks several complete user workflows. Performance measurements do not flip a row until its whole budget passes.",
  "3. Extend the nearest real browser or public MCP journey. Prove its success, applicable persistence/history, and a rejected operation. Reuse setup; add no unit tests or one-test-per-row suite.",
  "4. Record the command, source revision, date, result and limitations; link that evidence and set `done: true` only after the complete contract passes. A known regression sets it back to `false`.",
  "5. Run `pnpm cad:matrix` to regenerate this table and `pnpm verify` before landing. The matrix check validates links, binary states, evidence references, prerequisites, cycles and generated-document freshness; it cannot establish that a capability works.",
  "",
  "Keep IDs stable. Add newly discovered gaps; do not hide specialist rows, weaken budgets or subdivide already-passing rows to improve the count. Changes to acceptance scope require an explicit rationale and fresh applicable evidence. Listing a future capability does not authorize new services, licenses or architecture by itself.",
  "",
  "## Current implementation frontier",
  "",
  "Cold import remains first. `PERF-003` is the implementation approach to `PERF-001`, not a substitute for its usable-view budget. Native read/transfer alone previously exceeded that budget; optimize that stage as well as staging later work. Define the repeatable corpus in `PERF-012` alongside it. Then establish drawing semantics and DWG feasibility before spending effort on isolated drafting tools.",
  "",
  "| Contract | Status | Completion target | Prerequisites |",
  "| --- | --- | --- | --- |"
];
for (const id of matrix.frontier) {
  const f = features.get(id);
  lines.push(
    `| [${id}](#${id.toLowerCase()}) | ${status(f)} | ${cell(f.feature)} | ${f.dependsOn.join(", ") || "None declared"} |`
  );
}
lines.push(
  "",
  "## Coverage",
  "",
  "| Area | Priority | Done | Not done |",
  "| --- | ---: | ---: | ---: |"
);
for (const c of matrix.categories) {
  const rows = matrix.features.filter((f) => f.category === c.id);
  const done = rows.filter((f) => f.done).length;
  lines.push(
    `| [${c.title}](#area-${c.id}) | ${c.priority} | ${done} | ${rows.length - done} |`
  );
}
for (const c of matrix.categories) {
  lines.push(
    "",
    `<a id="area-${c.id}"></a>`,
    "",
    `## ${c.title}`,
    "",
    `Catalog context: ${c.sources.map((id) => `[${matrix.sources[id].title}](${matrix.sources[id].url})`).join("; ")}.`,
    "",
    `Existing foundation to inspect: ${link(c.foundation)}.`,
    "",
    "| ID | Feature | Status | Done only when | Prerequisites | Passing evidence |",
    "| --- | --- | --- | --- | --- | --- |"
  );
  for (const f of matrix.features.filter((f) => f.category === c.id)) {
    lines.push(
      `| <a id="${f.id.toLowerCase()}"></a>${f.id} | ${cell(f.feature)} | **${status(f)}** | ${cell(f.acceptance)} | ${f.dependsOn.map((id) => `[${id}](#${id.toLowerCase()})`).join(", ") || "—"} | ${f.evidence.map((id) => `[${id}](#evidence-${id})`).join(", ") || "—"} |`
    );
  }
}
lines.push(
  "",
  "## Evidence register",
  "",
  "Evidence covers the bounded contracts that cite it. September robot/gearbox records are retained historical E2E results, not new runs performed while authoring this inventory. A green default suite does not prove every row."
);
for (const [id, p] of Object.entries(matrix.evidence)) {
  lines.push(
    "",
    `<a id="evidence-${id}"></a>`,
    "",
    `### ${id}`,
    "",
    `${p.date}; source: ${p.sourceCommit}. ${p.scope}`,
    "",
    `Command: \`${p.command}\`.`,
    "",
    `Journeys: ${p.journeys.map(link).join(", ")}.`,
    "",
    `Recorded results: ${p.records.map(link).join(", ")}.`
  );
}
lines.push(
  "",
  "## Professional catalog sources",
  "",
  "These official public catalogs were read when creating the inventory. Their rolling product pages and regional/edition entitlements may change. The Onshape catalog endpoints attempted during this audit returned HTTP 404; no current Onshape-specific entitlement claims are made. Row-level acceptance criteria are engineering requirements, not quotations from these catalogs."
);
for (const source of Object.values(matrix.sources))
  lines.push(
    "",
    `- [${source.title}](${source.url}) — accessed ${source.accessed}.`
  );
lines.push(
  "",
  "The implementation order and product delivery goals remain in [the parity roadmap](parity-roadmap.md).",
  ""
);
const generated = lines.join("\n");
const notDoneCount = matrix.features.length - doneCount;
const overview = [
  "## Professional CAD feature map",
  "",
  `[![CAD feature map: ${matrix.features.length} features across ${matrix.categories.length} areas; ${doneCount} Done and ${notDoneCount} Not done. Each square represents one feature.](docs/assets/cad-feature-matrix.svg)](docs/cad-feature-matrix.md)`,
  "",
  `**${doneCount} Done · ${notDoneCount} Not done.** Every feature is binary: its entire acceptance contract passes, or it is Not done. Existing code without complete workflow evidence stays Not done. No partial statuses or percentage score.`,
  "",
  "[Browse the feature checklist](#feature-checklist) · [Read acceptance criteria and evidence](docs/cad-feature-matrix.md) · [See implementation order](docs/parity-roadmap.md)"
].join("\n");
const checklist = [
  "## Feature checklist",
  "",
  `All ${matrix.features.length} features are listed below, grouped into ${matrix.categories.length} areas. **Checked = Done; unchecked = Not done.** Follow a feature ID for its full completion criteria and evidence.`,
  "",
  "Generated from [the matrix source](docs/cad-feature-matrix.json) with `pnpm cad:matrix`. Use `pnpm cad:matrix --next` to choose the next contract."
];
for (const category of matrix.categories) {
  const rows = matrix.features.filter((f) => f.category === category.id);
  const done = rows.filter((f) => f.done).length;
  checklist.push(
    "",
    "<details>",
    `<summary>${category.title} — ${done} Done · ${rows.length - done} Not done</summary>`,
    "",
    ...rows.map(
      (f) =>
        `- [${f.done ? "x" : " "}] [${f.id}](docs/cad-feature-matrix.md#${f.id.toLowerCase()}) ${f.feature}`
    ),
    "",
    "</details>"
  );
}
let readme = readFileSync(readmePath, "utf8");
for (const [name, content] of [
  ["OVERVIEW", overview],
  ["FEATURES", checklist.join("\n")]
]) {
  const start = `<!-- CAD_MATRIX_${name}:START -->`;
  const end = `<!-- CAD_MATRIX_${name}:END -->`;
  requireValue(
    readme.split(start).length === 2 &&
      readme.split(end).length === 2 &&
      readme.indexOf(start) < readme.indexOf(end),
    `README requires exactly one ordered ${name} marker pair`
  );
  readme =
    readme.slice(0, readme.indexOf(start) + start.length) +
    `\n\n${content}\n\n` +
    readme.slice(readme.indexOf(end));
}

// A discrete map, not a progress bar: one square per binary feature contract.
// Pure SVG keeps the README portable, accessible and independent of chart services.
const xml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const rowHeight = 34;
const gridY = 220;
const maxColumns = Math.max(
  ...matrix.categories.map(
    (category) =>
      matrix.features.filter((f) => f.category === category.id).length
  )
);
const doneX = Math.max(1005, 438 + maxColumns * 21 + 63);
const notDoneX = doneX + 103;
const graphicWidth = notDoneX + 32;
const graphicHeight = gridY + matrix.categories.length * rowHeight + 74;
const graphic = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${graphicWidth}" height="${graphicHeight}" viewBox="0 0 ${graphicWidth} ${graphicHeight}" role="img" aria-labelledby="title description">`,
  `  <title id="title">Partbench professional CAD feature map</title>`,
  `  <desc id="description">${matrix.features.length} features across ${matrix.categories.length} areas: ${doneCount} Done and ${notDoneCount} Not done. One square per feature. Filled green squares with a check mean Done; outlined squares mean Not done. The README checklist provides every feature as text.</desc>`,
  `  <rect width="${graphicWidth}" height="${graphicHeight}" rx="16" fill="#0c1423"/>`,
  `  <g font-family="DejaVu Sans, Arial, sans-serif">`,
  `    <text x="32" y="43" fill="#6ee7b7" font-size="13" letter-spacing="3">PARTBENCH / CAPABILITY MAP</text>`,
  `    <text x="32" y="89" fill="#f1f5f9" font-size="32" font-weight="700">Professional CAD, one feature at a time.</text>`,
  `    <text x="32" y="123" fill="#a6b5cc" font-size="16">${matrix.features.length} feature contracts · ${matrix.categories.length} areas · Updated ${xml(matrix.updated)}</text>`,
  `    <rect x="32" y="148" width="16" height="16" rx="3" fill="#6ee7b7"/>`,
  `    <path d="M35 156 l3 3 7 -7" fill="none" stroke="#0c1423" stroke-width="2"/>`,
  `    <text x="60" y="162" fill="#f1f5f9" font-size="15">${doneCount} Done</text>`,
  `    <rect x="192" y="148" width="16" height="16" rx="3" fill="#172438" stroke="#73849d"/>`,
  `    <text x="220" y="162" fill="#f1f5f9" font-size="15">${notDoneCount} Not done</text>`,
  `    <text x="32" y="203" fill="#a6b5cc" font-size="12" letter-spacing="1">FEATURE AREA</text>`,
  `    <text x="438" y="203" fill="#a6b5cc" font-size="12" letter-spacing="1">ONE SQUARE = ONE FEATURE</text>`,
  `    <text x="${doneX}" y="203" fill="#6ee7b7" font-size="12" text-anchor="end">DONE</text>`,
  `    <text x="${notDoneX}" y="203" fill="#a6b5cc" font-size="12" text-anchor="end">NOT DONE</text>`
];
matrix.categories.forEach((category, index) => {
  const y = gridY + index * rowHeight;
  const rows = matrix.features.filter((f) => f.category === category.id);
  const done = rows.filter((f) => f.done).length;
  graphic.push(
    `    <rect x="20" y="${y - 3}" width="${graphicWidth - 40}" height="${rowHeight}" rx="4" fill="${index % 2 === 0 ? "#111e30" : "#0c1423"}"/>`,
    `    <text x="32" y="${y + 18}" fill="#e2e8f0" font-size="14">${xml(category.title)}</text>`
  );
  rows.forEach((f, featureIndex) => {
    const x = 438 + featureIndex * 21;
    graphic.push(
      `    <g><title>${xml(`${f.id}: ${f.feature} — ${status(f)}`)}</title><rect x="${x}" y="${y + 4}" width="16" height="16" rx="3" fill="${f.done ? "#6ee7b7" : "#172438"}" stroke="${f.done ? "#6ee7b7" : "#73849d"}"/>${f.done ? `<path d="M${x + 3} ${y + 12} l3 3 7 -7" fill="none" stroke="#0c1423" stroke-width="2"/>` : ""}</g>`
    );
  });
  graphic.push(
    `    <text x="${doneX}" y="${y + 18}" fill="#6ee7b7" font-size="14" text-anchor="end">${done}</text>`,
    `    <text x="${notDoneX}" y="${y + 18}" fill="#cbd5e1" font-size="14" text-anchor="end">${rows.length - done}</text>`
  );
});
graphic.push(
  `    <text x="32" y="${graphicHeight - 35}" fill="#a6b5cc" font-size="14">Done requires the complete workflow and passing E2E evidence. No partial credit.</text>`,
  "  </g>",
  "</svg>",
  ""
);
const artifacts = new Map([
  [output, generated],
  [readmePath, readme],
  [graphicPath, graphic.join("\n")]
]);
if (args.includes("--next")) {
  const queued = new Set();
  const order = [];
  function queue(id) {
    const f = features.get(id);
    if (f.done || queued.has(id)) return;
    queued.add(id);
    f.dependsOn.forEach(queue);
    order.push(f);
  }
  matrix.frontier.forEach(queue);
  [...matrix.features]
    .sort(
      (a, b) =>
        categories.get(a.category).priority -
        categories.get(b.category).priority
    )
    .forEach((f) => queue(f.id));
  for (const f of order.slice(0, 12)) {
    const unmet = f.dependsOn.filter((id) => !features.get(id).done);
    console.log(
      `${status(f)} | ${f.id} | ${f.feature} | ${unmet.length ? `Requires: ${unmet.join(", ")}` : "No unmet declared prerequisites"}`
    );
  }
} else if (args.includes("--check")) {
  for (const [path, content] of artifacts)
    requireValue(
      existsSync(path) && readFileSync(path, "utf8") === content,
      `Generated ${relative(root, path)} is stale. Run pnpm cad:matrix.`
    );
  console.log(
    `CAD matrix valid: ${matrix.features.length} contracts; ${doneCount} Done; ${matrix.features.length - doneCount} Not done.`
  );
} else {
  for (const [path, content] of artifacts) writeFileSync(path, content);
  console.log(
    `Wrote matrix, README checklist and graphic: ${matrix.features.length} contracts; ${doneCount} Done; ${matrix.features.length - doneCount} Not done.`
  );
}
