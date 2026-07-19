import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const V18_BUNDLE_LIMITS = Object.freeze({
  criticalJavaScriptGzipBytes: 400 * 1024,
  criticalCssGzipBytes: 20 * 1024,
  allUiJavaScriptGzipBytes: 550 * 1024
});

export function measureV18Bundle(distDirectory, geometryWorkerDistDirectory) {
  const assetsDirectory = join(distDirectory, "assets");
  const indexHtml = readFileSync(join(distDirectory, "index.html"), "utf8");
  const assetNames = readdirSync(assetsDirectory).sort();
  const files = Object.fromEntries(
    assetNames.map((name) => {
      const bytes = readFileSync(join(assetsDirectory, name));
      return [
        name,
        { rawBytes: bytes.byteLength, gzipBytes: gzipSync(bytes).byteLength }
      ];
    })
  );
  const criticalNames = readCriticalAssetNames(indexHtml);
  const isWorker = (name) => /(?:^|[.-])worker(?:[.-]|$)/i.test(name);
  const sum = (names) =>
    names.reduce(
      (total, name) => ({
        rawBytes: total.rawBytes + (files[name]?.rawBytes ?? 0),
        gzipBytes: total.gzipBytes + (files[name]?.gzipBytes ?? 0)
      }),
      { rawBytes: 0, gzipBytes: 0 }
    );
  const uiJavaScriptNames = assetNames.filter(
    (name) => extname(name) === ".js" && !isWorker(name)
  );

  const geometryWorkerFiles = geometryWorkerDistDirectory
    ? readAssetMetrics(geometryWorkerDistDirectory)
    : {};

  return {
    profile: {
      build: "production",
      derivedGeometry: true
    },
    criticalJavaScript: sum(
      criticalNames.filter((name) => extname(name) === ".js")
    ),
    criticalCss: sum(criticalNames.filter((name) => extname(name) === ".css")),
    allUiJavaScript: sum(uiJavaScriptNames),
    commandWorker: sum(
      assetNames.filter((name) => name.includes("cadCommand.worker"))
    ),
    geometryWorker: sumNamedMetrics(
      geometryWorkerFiles,
      Object.keys(geometryWorkerFiles).filter((name) =>
        name.includes("geometryTessellation.worker")
      )
    ),
    occtWasm: sum(
      assetNames.filter(
        (name) => extname(name) === ".wasm" && name.includes("opencascade")
      )
    ),
    files,
    geometryWorkerFiles
  };
}

export function readCriticalAssetNames(indexHtml) {
  const names = new Set();
  const assetPattern = /(?:src|href)=["'](?:\.\/|\/)?assets\/([^"']+)["']/g;
  for (const match of indexHtml.matchAll(assetPattern)) {
    names.add(basename(match[1]));
  }
  return [...names].sort();
}

export function auditV18Bundle(metrics, baseline) {
  const failures = [];
  checkMaximum(
    failures,
    "critical JavaScript",
    metrics.criticalJavaScript.gzipBytes,
    V18_BUNDLE_LIMITS.criticalJavaScriptGzipBytes
  );
  checkMaximum(
    failures,
    "critical CSS",
    metrics.criticalCss.gzipBytes,
    V18_BUNDLE_LIMITS.criticalCssGzipBytes
  );
  checkMaximum(
    failures,
    "all UI JavaScript",
    metrics.allUiJavaScript.gzipBytes,
    V18_BUNDLE_LIMITS.allUiJavaScriptGzipBytes
  );

  for (const [label, key] of [
    ["command worker", "commandWorker"],
    ["geometry worker", "geometryWorker"],
    ["OCCT WASM", "occtWasm"]
  ]) {
    if (baseline[key].gzipBytes > 0 && metrics[key].gzipBytes === 0) {
      failures.push(`${label}: expected an emitted artifact but measured none`);
      continue;
    }
    checkMaximum(
      failures,
      label,
      metrics[key].gzipBytes,
      baseline[key].gzipBytes
    );
  }

  return failures;
}

function readAssetMetrics(distDirectory) {
  const assetsDirectory = join(distDirectory, "assets");
  return Object.fromEntries(
    readdirSync(assetsDirectory)
      .sort()
      .map((name) => {
        const bytes = readFileSync(join(assetsDirectory, name));
        return [
          name,
          { rawBytes: bytes.byteLength, gzipBytes: gzipSync(bytes).byteLength }
        ];
      })
  );
}

function sumNamedMetrics(files, names) {
  return names.reduce(
    (total, name) => ({
      rawBytes: total.rawBytes + (files[name]?.rawBytes ?? 0),
      gzipBytes: total.gzipBytes + (files[name]?.gzipBytes ?? 0)
    }),
    { rawBytes: 0, gzipBytes: 0 }
  );
}

function checkMaximum(failures, label, actual, maximum) {
  if (actual > maximum) {
    failures.push(`${label}: ${actual} gzip bytes exceeds ${maximum}`);
  }
}

function run() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const reportOnly = process.argv.includes("--report-only");
  const metrics = measureV18Bundle(
    join(repositoryRoot, "apps/web/dist"),
    join(repositoryRoot, "apps/web/dist-geometry-worker-smoke")
  );
  const outputPath = join(repositoryRoot, ".metrics/v18-bundle.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(metrics, null, 2)}\n`);

  if (!reportOnly) {
    const baseline = JSON.parse(
      readFileSync(
        join(repositoryRoot, "scripts/v18-bundle-baseline.json"),
        "utf8"
      )
    );
    const failures = auditV18Bundle(metrics, baseline);
    if (failures.length > 0) {
      throw new Error(`V18 bundle gate failed:\n- ${failures.join("\n- ")}`);
    }
  }

  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run();
}
