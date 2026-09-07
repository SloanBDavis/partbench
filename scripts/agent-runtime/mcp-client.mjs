import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { performance } from "node:perf_hooks";
import { clearTimeout } from "node:timers";

/** Small real-stdio client shared by the closer and manual agent trials. */
export class HeadlessMcpClient {
  #child;
  #pending = new Map();
  #nextId = 1;
  #stderr = "";
  #closed;
  #protocolError;
  #terminalError;
  #shutdownStarted = false;
  calls = [];

  constructor({ executable, workspace }) {
    this.startedAt = performance.now();
    this.#child = spawn(
      process.execPath,
      [executable, "--headless", "--workspace", workspace],
      {
        stdio: ["pipe", "pipe", "pipe"]
      }
    );
    this.#child.stderr.on("data", (chunk) => {
      this.#stderr = (this.#stderr + chunk).slice(-8_192);
    });
    const lines = createInterface({ input: this.#child.stdout });
    lines.on("line", (line) => {
      let response;
      try {
        response = JSON.parse(line);
      } catch {
        this.#protocolError = new Error(
          `Non-JSON MCP stdout: ${line.slice(0, 200)}`
        );
        this.#fail(this.#protocolError);
        return;
      }
      const pending = this.#pending.get(response.id);
      if (!pending) return;
      this.#pending.delete(response.id);
      clearTimeout(pending.timeout);
      if (response.error)
        pending.reject(new Error(JSON.stringify(response.error)));
      else pending.resolve(response.result);
    });
    this.#child.on("error", (error) => this.#fail(error));
    this.#child.stdin.on("error", (error) => this.#fail(error));
    this.#closed = new Promise((resolve) =>
      // Unlike exit, close also fires after a failed spawn and waits for stdio.
      this.#child.on("close", (code, signal) => {
        this.#fail(new Error(`MCP exited ${code ?? signal}: ${this.#stderr}`));
        resolve({ code, signal });
      })
    );
  }

  #fail(error) {
    this.#terminalError ??= error;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  request(method, params = {}) {
    if (this.#terminalError) return Promise.reject(this.#terminalError);
    if (this.#shutdownStarted)
      return Promise.reject(new Error("MCP client is closing or closed."));
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`MCP ${method} timed out: ${this.#stderr}`));
      }, 60_000);
      this.#pending.set(id, { resolve, reject, timeout });
      this.#child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`
      );
    });
  }

  async initialize() {
    const result = await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "partbench-runtime-closer", version: "1.0.0" }
    });
    this.#child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`
    );
    this.startupMs = performance.now() - this.startedAt;
    return result;
  }

  async tool(name, args = {}, { expectError = false } = {}) {
    const start = performance.now();
    const result = await this.request("tools/call", { name, arguments: args });
    const value = result.structuredContent;
    this.calls.push({
      name,
      milliseconds: performance.now() - start,
      responseBytes: Buffer.byteLength(JSON.stringify(result))
    });
    if (
      expectError
        ? !result.isError || value?.ok !== false
        : result.isError || value?.ok === false
    ) {
      throw new Error(
        `${name}: ${JSON.stringify(value ?? result).slice(0, 3_000)}`
      );
    }
    return value;
  }

  async close() {
    if (!this.#shutdownStarted) {
      this.#shutdownStarted = true;
      if (!this.#child.stdin.destroyed && !this.#child.stdin.writableEnded)
        this.#child.stdin.end();
    }
    const timeout = setTimeout(() => this.#child.kill("SIGKILL"), 5_000);
    const result = await this.#closed;
    clearTimeout(timeout);
    if (this.#protocolError) throw this.#protocolError;
    if (result.code !== 0)
      throw new Error(
        `MCP shutdown failed: ${JSON.stringify(result)} ${this.#stderr}`
      );
  }
}
