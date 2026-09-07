#!/usr/bin/env node
import { createCadMcpServer } from "@web-cad/mcp-adapter";
import { createMcpStdioSession } from "@web-cad/mcp-stdio-server";
import { openLocalAgentBrowser, startLocalAgentLauncher } from "./launcher.ts";
import { CLI_HELP, parseCliOptions } from "./cliOptions.ts";

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Local agent launcher failed."}\n`
  );
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(CLI_HELP);
    return;
  }
  const host = options.headless
    ? await (
        await import("./headless.ts")
      ).createHeadlessAgentHost({ workspace: options.workspace })
    : await createBrowserHost();
  const session = createMcpStdioSession({
    server: host.server
  });
  const pending = new Set<Promise<void>>();
  let buffer = "";
  let closing = false;

  if ("workspace" in host)
    process.stderr.write(`Partbench headless agent: ${host.workspace}\n`);

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
    const task = session
      .handleLineAsync(line)
      .then((response) => {
        if (response) process.stdout.write(`${response}\n`);
      })
      .catch((error: unknown) => {
        process.stderr.write(
          `${error instanceof Error ? error.message : "Request failed."}\n`
        );
        process.exitCode = 1;
      });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  }

  async function close(): Promise<void> {
    if (closing) return;
    closing = true;
    // Browser relay shutdown resolves pending requests; headless drains them first.
    if (!options.headless) await host.close();
    await Promise.allSettled(pending);
    if (options.headless) await host.close();
  }
}

async function createBrowserHost() {
  const launcher = await startLocalAgentLauncher();
  process.stderr.write(`Partbench local agent: ${launcher.launchUrl}\n`);
  if (process.env.PARTBENCH_SKIP_BROWSER_OPEN !== "1")
    openLocalAgentBrowser(launcher.launchUrl);
  return {
    server: createCadMcpServer({ executionPort: launcher.relay }),
    close: () => launcher.close()
  };
}
