#!/usr/bin/env node
import { createMcpStdioSession } from "@web-cad/mcp-stdio-server";

interface StdioReadable {
  setEncoding(encoding: "utf8"): void;
  on(event: "data", listener: (chunk: string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
}

interface StdioWritable {
  write(chunk: string): void;
}

declare const process: {
  readonly stdin: StdioReadable;
  readonly stdout: StdioWritable;
  readonly stderr: StdioWritable;
  exitCode?: number;
};

const session = createMcpStdioSession();
let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  flushCompleteLines();
});
process.stdin.on("end", () => {
  if (buffer.trim().length > 0) {
    writeLineResponse(buffer);
  }
});
process.stdin.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
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
  const response = session.handleLine(line);

  if (response) {
    process.stdout.write(`${response}\n`);
  }
}
