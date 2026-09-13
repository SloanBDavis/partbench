import type { OpenCascadeInstance } from "opencascade.js";
import type {
  OcctExactBodyMetadata,
  OcctExactTopologySnapshot,
  OcctExactTopologySourceKind
} from "./exactMetadata";

const MAX_BYTES = 128 * 1024 * 1024;
const MAX_ENTRIES = 256;
interface Evidence {
  readonly topology: OcctExactTopologySnapshot;
  readonly metadata: OcctExactBodyMetadata;
}
interface Entry extends Evidence {
  readonly bytes: Uint8Array;
  readonly cost: number;
}
const caches = new WeakMap<
  OpenCascadeInstance,
  { entries: Map<string, Entry>; bytes: number }
>();
const metadataBySnapshot = new WeakMap<
  OcctExactTopologySnapshot,
  OcctExactBodyMetadata
>();

/** Only remember evidence measured on the canonical, validated BRep shape.
 * A cache belongs to one loaded kernel; normalized coordinates already encode
 * document units. Source kind remains part of the topology-signature identity.
 */
export function rememberExactCheckpoint(
  oc: OpenCascadeInstance,
  sha256: string,
  bytes: Uint8Array,
  evidence: Evidence
): void {
  metadataBySnapshot.set(evidence.topology, structuredClone(evidence.metadata));
  const key = `${evidence.topology.sourceKind}:${sha256}`;
  const cost = bytes.byteLength + JSON.stringify(evidence).length * 2;
  if (cost > MAX_BYTES) return;
  let cache = caches.get(oc);
  if (!cache) {
    cache = { entries: new Map(), bytes: 0 };
    caches.set(oc, cache);
  }
  const previous = cache.entries.get(key);
  if (previous) {
    cache.bytes -= previous.cost;
    cache.entries.delete(key);
  }
  while (cache.entries.size >= MAX_ENTRIES || cache.bytes + cost > MAX_BYTES) {
    const oldestKey = cache.entries.keys().next().value;
    if (oldestKey === undefined) break;
    cache.bytes -= cache.entries.get(oldestKey)!.cost;
    cache.entries.delete(oldestKey);
  }
  cache.entries.set(key, {
    ...structuredClone(evidence),
    bytes: bytes.slice(),
    cost
  });
  cache.bytes += cost;
}

/** A declared hash is never sufficient: compare the actual owned bytes too.
 * Callers receive copies, so neither detached transfers nor mutated responses
 * can alter the evidence retained by the kernel boundary.
 */
export function readExactCheckpoint(
  oc: OpenCascadeInstance,
  sha256: string,
  bytes: Uint8Array,
  sourceKind: OcctExactTopologySourceKind
): Evidence | undefined {
  const cache = caches.get(oc);
  const key = `${sourceKind}:${sha256}`;
  const entry = cache?.entries.get(key);
  if (
    !entry ||
    entry.bytes.byteLength !== bytes.byteLength ||
    !entry.bytes.every((value, index) => value === bytes[index])
  )
    return undefined;
  cache!.entries.delete(key);
  cache!.entries.set(key, entry);
  const evidence = structuredClone({
    topology: entry.topology,
    metadata: entry.metadata
  });
  metadataBySnapshot.set(evidence.topology, evidence.metadata);
  return evidence;
}

export function metadataForVerifiedCheckpoint(
  snapshot: OcctExactTopologySnapshot
): OcctExactBodyMetadata | undefined {
  return metadataBySnapshot.get(snapshot);
}

export async function checkpointSha256(bytes: Uint8Array): Promise<string> {
  const owned = bytes.slice();
  const hash = await globalThis.crypto.subtle.digest("SHA-256", owned);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
