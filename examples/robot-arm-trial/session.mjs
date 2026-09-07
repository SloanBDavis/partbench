import { HeadlessMcpClient } from "../../scripts/agent-runtime/mcp-client.mjs";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { Buffer } from "node:buffer";

const workspace = resolve(process.argv[2] ?? ".metrics/robot-arm-trial");
const session = new Date().toISOString().replaceAll(":", "-");
const dir = resolve(workspace, "sessions", session);
mkdirSync(dir, { recursive: true });
const client = new HeadlessMcpClient({
  executable: resolve("packages/mcp-stdio-server/dist/stdio.js"),
  workspace
});
let index = 0;
const original = client.request.bind(client);
client.request = async (method, params = {}) => {
  const call = {
    ref: `${session}/${String(++index).padStart(3, "0")}`,
    startedAt: new Date().toISOString(),
    method,
    params
  };
  const start = performance.now();
  call.requestBytes = Buffer.byteLength(JSON.stringify({ method, params }));
  appendFileSync(
    resolve(workspace, "transcript.jsonl"),
    JSON.stringify({ event: "request", ...call }) + "\n"
  );
  try {
    const result = await original(method, params);
    Object.assign(call, {
      durationMs: performance.now() - start,
      responseBytes: Buffer.byteLength(JSON.stringify(result)),
      failed: !!result.isError || result.structuredContent?.ok === false,
      result
    });
    return result;
  } catch (error) {
    Object.assign(call, {
      durationMs: performance.now() - start,
      failed: true,
      error: String(error)
    });
    throw error;
  } finally {
    writeFileSync(
      resolve(dir, `${String(index).padStart(3, "0")}.json`),
      JSON.stringify(call, null, 2)
    );
    appendFileSync(
      resolve(workspace, "transcript.jsonl"),
      JSON.stringify({ event: "response", ...call }) + "\n"
    );
    process.stdout.write(
      JSON.stringify({
        ref: call.ref,
        failed: call.failed,
        durationMs: call.durationMs,
        responseBytes: call.responseBytes,
        resultFile: resolve(dir, `${String(index).padStart(3, "0")}.json`)
      }) + "\n"
    );
  }
};
try {
  await client.initialize();
  process.stdout.write(
    JSON.stringify({ ready: true, session, workspace }) + "\n"
  );
  for await (const line of createInterface({ input: process.stdin })) {
    if (!line.trim()) continue;
    try {
      const command = JSON.parse(line);
      if (command.close) break;
      const request = command.file
        ? JSON.parse(readFileSync(command.file, "utf8"))
        : command;
      const result = await client.request(
        request.method ?? "tools/call",
        request.params ?? {
          name: request.name,
          arguments: request.arguments ?? {}
        }
      );
      if (command.print)
        process.stdout.write(
          JSON.stringify(result.structuredContent ?? result).slice(
            0,
            command.limit ?? 3000
          ) + "\n"
        );
    } catch (error) {
      process.exitCode = 1;
      process.stdout.write(
        JSON.stringify({ caught: String(error).slice(0, 3000) }) + "\n"
      );
    }
  }
} catch (error) {
  process.exitCode = 1;
  process.stdout.write(
    JSON.stringify({ fatal: String(error).slice(0, 3000) }) + "\n"
  );
} finally {
  try {
    await client.close();
  } catch (error) {
    process.exitCode = 1;
    process.stdout.write(
      JSON.stringify({ closeError: String(error).slice(0, 1500) }) + "\n"
    );
  }
}
