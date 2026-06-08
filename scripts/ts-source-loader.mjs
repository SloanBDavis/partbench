import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const resolved = await resolveTypeScriptSpecifier(specifier, context);

    if (resolved) {
      return resolved;
    }

    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".ts")) {
    return nextLoad(url, context);
  }

  const source = await readFile(fileURLToPath(url), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      isolatedModules: true,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      useDefineForClassFields: true
    },
    fileName: fileURLToPath(url)
  });

  return {
    format: "module",
    shortCircuit: true,
    source: transpiled.outputText
  };
}

async function resolveTypeScriptSpecifier(specifier, context) {
  if (!context.parentURL || !specifier.startsWith(".")) {
    return undefined;
  }

  for (const candidate of [
    new URL(`${specifier}.ts`, context.parentURL),
    new URL(`${specifier}/index.ts`, context.parentURL)
  ]) {
    if (await fileExists(candidate)) {
      return {
        shortCircuit: true,
        url: candidate.href
      };
    }
  }

  return undefined;
}

async function fileExists(url) {
  try {
    await access(fileURLToPath(url));
    return true;
  } catch {
    return false;
  }
}
