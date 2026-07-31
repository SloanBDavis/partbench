#!/usr/bin/env node
import { createCadMcpServer } from "@web-cad/mcp-adapter";
import { createMcpStdioSession } from "@web-cad/mcp-stdio-server";
import { openLocalAgentBrowser, startLocalAgentLauncher } from "./launcher.ts";

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Local agent launcher failed."}\n`
  );
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const launcher = await startLocalAgentLauncher();
  const session = createMcpStdioSession({
    server: createCadMcpServer({ executionPort: launcher.relay })
  });
  const pending = new Set<Promise<void>>();
  let buffer = "";
  let closing = false;

  process.stderr.write(`Partbench local agent: ${launcher.launchUrl}\n`);
  if (process.env.PARTBENCH_SKIP_BROWSER_OPEN !== "1") {
    openLocalAgentBrowser(launcher.launchUrl);
  }

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    flushCompleteLines();
  });
  process.stdin.on("end", () => {
    if (buffer.trim().length > 0) writeLineResponse(buffer);
    void close();
  });
  process.stdin.on("error", (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    void close();
  });

  function flushCompleteLines(): void {
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      writeLineResponse(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  function writeLineResponse(line: string): void {
    const task = session.handleLineAsync(line).then((response) => {
      if (response) process.stdout.write(`${response}\n`);
    });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  }

  async function close(): Promise<void> {
    if (closing) return;
    closing = true;
    await launcher.close();
    await Promise.allSettled(pending);
  }
}
