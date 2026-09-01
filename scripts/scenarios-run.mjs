import { readdir, readFile } from "node:fs/promises";
import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scenariosDir = resolve(repoRoot, "scenarios");
const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);

const { CadEngine } = await import(
  pathToFileURL(resolve(repoRoot, "packages/cad-core/src/index.ts")).href
);

function fail(message) {
  throw new Error(message);
}

function matches(actual, expected) {
  if (expected === null || typeof expected !== "object") {
    return Object.is(actual, expected);
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) {
      return false;
    }
    return expected.every((item, index) => matches(actual[index], item));
  }
  if (actual === null || typeof actual !== "object") {
    return false;
  }
  return Object.entries(expected).every(([key, value]) =>
    matches(actual[key], value)
  );
}

function assertMatch(actual, expected, label) {
  if (!matches(actual, expected)) {
    fail(
      `${label} mismatch.\nexpected ${JSON.stringify(expected)}\nactual ${JSON.stringify(actual)}`
    );
  }
}

function assertPublicJson(value, label) {
  const publicJson = JSON.stringify(value);
  if (PRIVATE_ID_PATTERN.test(publicJson)) {
    fail(`${label} leaked a private exact identity: ${publicJson}`);
  }
}

function readBodySourceSignature(engine, bodyId) {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId }
  });
  if (!response.ok || response.query !== "body.topology") {
    fail("Expected body.topology response.");
  }
  return response.topology.sourceIdentity.signature;
}

function currentEvidence(engine, scenario, kind) {
  const template = scenario.evidence;
  return {
    bodyId: template.bodyId,
    bodySourceIdentitySignature: readBodySourceSignature(
      engine,
      template.bodyId
    ),
    topologySignature: template.topologySignature,
    entityKind: kind,
    localId: template.localIdTemplate.replaceAll("{kind}", kind),
    entitySignature: template.entitySignatureTemplate.replaceAll("{kind}", kind)
  };
}

function queryCandidates(engine, scenario, testCase) {
  const evidence = currentEvidence(engine, scenario, testCase.kind);
  const query = {
    query: testCase.query.query,
    currentTopologyEvidence: evidence
  };
  if (testCase.query.requiredOperation) {
    query.requiredOperation = testCase.query.requiredOperation;
  }
  if (testCase.query.selection) {
    fail("selection and currentTopologyEvidence are XOR; do not send both.");
  }
  return engine.executeQuery({
    version: "cadops.v1",
    query
  });
}

function promotionOps(engine, scenario, testCase) {
  const apply = testCase.apply;
  const evidence = currentEvidence(engine, scenario, testCase.kind);
  const checkpoint = {
    op: "topology.checkpoint.create",
    checkpointId: apply.checkpointId,
    bodyId: scenario.evidence.bodyId,
    sourceFeatureId: apply.sourceFeatureId,
    sourceIdentity: scenario.checkpointSourceIdentity,
    status: "active"
  };
  const anchor = {
    op: "topology.anchor.create",
    anchorId: apply.anchorId,
    entityKind: testCase.kind,
    bodyId: scenario.evidence.bodyId,
    checkpointId: apply.checkpointId,
    checkpointEntityId: evidence.localId,
    sourceFeatureId: apply.sourceFeatureId,
    signatureHash: evidence.entitySignature
  };
  if (!apply.omitStableId) {
    fail("promotion anchor must omit stableId.");
  }
  return [checkpoint, anchor, apply.consuming];
}

function runCadopsScenario(name, scenario) {
  const engine = new CadEngine();
  if (Array.isArray(scenario.seed) && scenario.seed.length > 0) {
    engine.applyBatch(scenario.seed);
  }

  for (const step of scenario.steps) {
    const result = engine.applyBatch(step.ops);
    const appliedOps = result.transaction.ops.map((op) => op.op);
    if (step.expect?.ops) {
      assertMatch(
        appliedOps,
        step.expect.ops,
        `${name} ${step.id} ops`
      );
    }
    if (step.expect?.diff) {
      assertMatch(
        result.transaction.diff,
        step.expect.diff,
        `${name} ${step.id} diff`
      );
    }
    for (const queryCase of step.queries ?? []) {
      const response = engine.executeQuery({
        version: "cadops.v1",
        query: queryCase.query
      });
      assertPublicJson(response, `${name} ${step.id} query`);
      if (queryCase.expect) {
        assertMatch(
          response,
          queryCase.expect,
          `${name} ${step.id} query`
        );
      }
    }
  }
}

function runCase(scenario, testCase) {
  const engine = new CadEngine();
  engine.applyBatch(scenario.seed);

  const queryResponse = queryCandidates(engine, scenario, testCase);
  assertMatch(queryResponse, testCase.expectQuery, `${testCase.id} query`);
  assertPublicJson(queryResponse, `${testCase.id} query`);

  if (!testCase.apply) {
    return;
  }

  const ops = promotionOps(engine, scenario, testCase);
  const result = engine.applyBatch(ops);
  const appliedOps = result.transaction.ops.map((op) => op.op);
  assertMatch(appliedOps, testCase.expectApply.ops, `${testCase.id} apply ops`);

  if (testCase.expectApply.anchorOmitsStableId) {
    const anchor = result.transaction.ops[1];
    if (anchor.op !== "topology.anchor.create" || "stableId" in anchor) {
      fail(`${testCase.id} expected omitted-stableId topology.anchor.create.`);
    }
  }

  if (testCase.expectApply.diff) {
    assertMatch(
      result.transaction.diff,
      testCase.expectApply.diff,
      `${testCase.id} apply diff`
    );
  }

  const afterQuery = queryCandidates(engine, scenario, testCase);
  assertPublicJson(afterQuery, `${testCase.id} query after apply`);
  if (testCase.expectAfterQuery) {
    assertMatch(
      afterQuery,
      testCase.expectAfterQuery,
      `${testCase.id} query after apply`
    );
  }
}

async function loadScenarios() {
  const names = (await readdir(scenariosDir))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const loaded = [];
  for (const name of names) {
    const raw = await readFile(resolve(scenariosDir, name), "utf8");
    loaded.push({ name, scenario: JSON.parse(raw) });
  }
  return loaded;
}

const loaded = await loadScenarios();
let passed = 0;
let total = 0;

for (const { name, scenario } of loaded) {
  if (Array.isArray(scenario.steps)) {
    total += 1;
    try {
      runCadopsScenario(name, scenario);
      console.log(`pass ${name} ${scenario.id ?? name}`);
      passed += 1;
    } catch (error) {
      console.error(`fail ${name} ${scenario.id ?? name}`);
      console.error(error instanceof Error ? error.message : error);
    }
    continue;
  }

  for (const testCase of scenario.cases) {
    total += 1;
    try {
      runCase(scenario, testCase);
      console.log(`pass ${name} ${testCase.id}`);
      passed += 1;
    } catch (error) {
      console.error(`fail ${name} ${testCase.id}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }
}

console.log(`scenarios passed ${passed}/${total}`);
if (passed !== total) {
  process.exitCode = 1;
}
