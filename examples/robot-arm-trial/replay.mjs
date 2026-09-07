import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import assert from "node:assert/strict";
const workspace = resolve(process.argv[2] ?? ".metrics/robot-arm-trial/replay");
mkdirSync(workspace, { recursive: true });
const parts = [
  "base",
  "yaw",
  "shoulder",
  "upper",
  "forearm",
  "wrist",
  "rail",
  "finger",
  "pin8",
  "bolt4",
  "spacer"
];
const file = (name) => ({ file: `examples/robot-arm-trial/${name}.json` });
const tool = (name, args = {}) => ({ name, arguments: args });
async function session(commands) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["examples/robot-arm-trial/session.mjs", workspace],
      { stdio: ["pipe", "inherit", "inherit"] }
    );
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Session exit ${code}`))
    );
    child.stdin.end(
      [...commands, { close: true }].map((x) => JSON.stringify(x)).join("\n") +
        "\n"
    );
  });
}
try {
  await session([
    { method: "tools/list" },
    tool("cad.session_info"),
    file("04-xy-sketches"),
    file("03-regions"),
    file("06-static-pose"),
    tool("cad.project_save", { path: "initial.wcad" }),
    file("07-revision-dry-run"),
    file("07-revision"),
    tool("cad.project_structure"),
    file("08-gripper-motion"),
    tool("cad.project_structure"),
    file("09-gripper-return"),
    tool("cad.project_save", { path: "robot-arm-final.wcad" }),
    ...parts.flatMap((id) => [
      tool("cad.body_mass_properties", { bodyId: `b_${id}` }),
      tool("cad.project_export_file", {
        path: `part-${id}.step`,
        format: "step",
        bodyIds: [`b_${id}`]
      })
    ]),
    tool("cad.project_export_file", {
      path: "robot-arm-part-definitions.step",
      format: "step",
      bodyIds: parts.map((id) => `b_${id}`)
    })
  ]);
  await session([
    tool("cad.project_open", { path: "robot-arm-final.wcad" }),
    tool("cad.project_structure"),
    tool("cad.parameter_list"),
    ...parts.map((id) =>
      tool("cad.body_mass_properties", { bodyId: `b_${id}` })
    )
  ]);
  const calls = readFileSync(resolve(workspace, "transcript.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse)
    .filter((x) => x.event === "response");
  const failures = calls.filter((x) => x.failed);
  if (failures.length)
    throw new Error(
      `Replay had ${failures.length} failed calls; inspect ${workspace}/transcript.jsonl`
    );
  const results = (name) =>
    calls
      .filter((x) => x.params.name === name)
      .map((x) => x.result.structuredContent);
  const partInputs = JSON.parse(
    readFileSync("examples/robot-arm-trial/parts.json")
  );
  const massResults = results("cad.body_mass_properties");
  assert.equal(
    massResults.length,
    parts.length * 2,
    "Inspect each definition before and after reopen"
  );
  for (const result of massResults) {
    const part = partInputs.find(
      (p) => `b_${p.id}` === result.massProperties.bodyId
    );
    assert.ok(part, "Known output body");
    const outline = part.radius
      ? Math.PI * part.radius ** 2
      : (part.id === "upper" ? 210 : part.width) * part.height;
    const holes = part.holes.reduce(
      (sum, hole) => sum + Math.PI * hole[2] ** 2,
      0
    );
    assert.equal(result.massProperties.measurementSource, "kernel-derived");
    assert.ok(
      Math.abs(result.massProperties.volume - (outline - holes) * part.depth) <
        1e-5,
      part.id
    );
  }
  const structures = results("cad.project_structure");
  const beforeReopen = structures.at(-2).assemblies;
  const afterReopen = structures.at(-1).assemblies;
  // The last pre-reopen snapshot is the temporary 25 mm jaw pose. Verify final
  // persisted placement against the declared restored 35 mm pose instead.
  assert.equal(beforeReopen[0].instances.length, 29);
  const assembly = afterReopen[0];
  assert.equal(assembly.instances.length, 29);
  assert.equal(assembly.mates.length, 29);
  const pose = JSON.parse(
    readFileSync("examples/robot-arm-trial/pose-revised.json")
  );
  for (const intended of pose.instances) {
    const actual = assembly.instances.find((i) => i.id === intended.id);
    assert.ok(actual, intended.id);
    for (const field of ["translation", "rotation"])
      for (let i = 0; i < 3; i++)
        assert.ok(
          Math.abs(actual.transform[field][i] - intended.transform[field][i]) <
            1e-6,
          intended.id
        );
  }
  assert.deepEqual(
    results("cad.project_save").at(-1).result.sourceIdentity,
    results("cad.project_open").at(-1).result.sourceIdentity
  );
  process.stdout.write(`Replay artifacts: ${workspace}\n`);
} catch (error) {
  process.stderr.write(String(error).slice(0, 2000) + "\n");
  process.exitCode = 1;
}
