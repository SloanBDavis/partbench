import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
import { register } from "node:module";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import os from "node:os";
import { resolve } from "node:path";
register(
  new URL("../../scripts/ts-source-loader.mjs", import.meta.url),
  import.meta.url
);
const { loadOcct } = await import("../../packages/occt-wasm/src/index.ts");
const { readExactTopologySnapshot } =
  await import("../../packages/occt-wasm/src/exactMetadata.ts");
const bytes = new Uint8Array(
  await readFile(
    resolve(process.argv[2] ?? ".metrics/engine-step-trial/radial-engine.step")
  )
);
const report = {
  kind: "Isolated direct OCCT stage diagnostic; no browser or concurrent CAD run",
  inputSha256: createHash("sha256").update(bytes).digest("hex"),
  inputBytes: bytes.byteLength,
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  cpu: os.cpus()[0].model,
  logicalCpus: os.cpus().length,
  stages: []
};
const reportUrl = resolve(
  process.argv[3] ?? ".metrics/engine-step-trial/stage-profile.json"
);
async function stage(name, fn) {
  const start = performance.now();
  const result = await fn();
  const entry = {
    name,
    milliseconds: Math.round((performance.now() - start) * 10) / 10
  };
  report.stages.push(entry);
  console.log(JSON.stringify(entry));
  await writeFile(reportUrl, JSON.stringify(report, null, 2) + "\n");
  return result;
}
const oc = await stage("loadOcct", () => loadOcct());
report.bindings = Object.fromEntries(
  [
    "STEPCAFControl_Reader_1",
    "STEPCAFControl_Writer_1",
    "XCAFDoc_DocumentTool",
    "XCAFDoc_ShapeTool",
    "TDocStd_Document",
    "BRepTools_History"
  ].map((k) => [k, typeof oc[k] === "function"])
);
const progress = new oc.Message_ProgressRange_1();
const reader = new oc.STEPControl_Reader_1();
const path = "/tmp/engine-stage-profile.step";
oc.FS.writeFile(path, bytes);
const status = await stage("readStep", () => reader.ReadFile(path));
if (status !== oc.IFSelect_ReturnStatus.IFSelect_RetDone)
  throw new Error("STEP read failed");
report.transferredRoots = await stage("transferRoots", () =>
  reader.TransferRoots(progress)
);
const source = reader.OneShape();
const fixer = new oc.ShapeFix_Shape_1();
fixer.Init(source);
report.healingApplied = Boolean(
  await stage("healShape", () => fixer.Perform(progress))
);
const shape = fixer.Shape();
const snapshot = await stage("topologySnapshot", () =>
  readExactTopologySnapshot(oc, shape, "importedBody")
);
report.topologyCounts = snapshot.entityCounts;
report.topologyEntities = snapshot.entityCount;
const brepPath = "/tmp/engine-stage-profile.brep";
await stage("writeBrep", () => {
  if (!oc.BRepTools.Write_3(shape, brepPath, progress))
    throw new Error("BRep write failed");
  report.brepBytes = oc.FS.readFile(brepPath).byteLength;
});
report.totalMilliseconds = report.stages.reduce(
  (n, s) => n + s.milliseconds,
  0
);
await writeFile(reportUrl, JSON.stringify(report, null, 2) + "\n");
oc.FS.unlink(brepPath);
oc.FS.unlink(path);
shape.delete();
fixer.delete();
source.delete();
reader.delete();
progress.delete();
console.log(JSON.stringify(report, null, 2));
