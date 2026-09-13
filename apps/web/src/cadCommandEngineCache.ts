import { CadEngine, sha256Hex, type CadProject } from "@web-cad/cad-core/full";

/** A small cache of validated worker authority, never of unvalidated snapshots. */
export class CadCommandEngineCache {
  readonly #entries = new Map<string, { engine: CadEngine; bytes: number }>();
  #bytes = 0;

  constructor(
    readonly maxEntries = 2,
    readonly maxProjectBytes = 8 * 1024 * 1024
  ) {}

  load(project: CadProject): CadEngine {
    const identity = this.#identity(project);
    const existing = this.#entries.get(identity.key);
    if (existing) {
      this.#entries.delete(identity.key);
      this.#entries.set(identity.key, existing);
      return existing.engine.forkForValidation();
    }
    // The hash covers every incoming field, including history and unknown
    // fields. A changed or malformed external project cannot reuse authority.
    const engine = CadEngine.fromProject(project);
    this.#retain(identity, engine);
    return engine;
  }

  remember(engine: CadEngine): void {
    this.#retain(this.#identity(engine.exportProject()), engine);
  }

  #identity(project: CadProject) {
    const bytes = new TextEncoder().encode(JSON.stringify(project));
    return { key: sha256Hex(bytes), bytes: bytes.byteLength };
  }

  #retain(identity: { key: string; bytes: number }, engine: CadEngine): void {
    if (identity.bytes > this.maxProjectBytes || this.maxEntries <= 0) return;
    const previous = this.#entries.get(identity.key);
    if (previous) {
      this.#bytes -= previous.bytes;
      this.#entries.delete(identity.key);
    }
    this.#entries.set(identity.key, {
      engine: engine.forkForValidation(),
      bytes: identity.bytes
    });
    this.#bytes += identity.bytes;
    while (
      this.#entries.size > this.maxEntries ||
      this.#bytes > this.maxProjectBytes
    ) {
      const key = this.#entries.keys().next().value!;
      this.#bytes -= this.#entries.get(key)!.bytes;
      this.#entries.delete(key);
    }
  }
}
