import type { ExactBodyArtifactShapePolicy } from "@web-cad/geometry-worker";
import type { CurrentExactBodyArtifactEvidence as GeometryKernelExactBodyArtifact } from "./currentExactBodyResolver";
type ExactTopologySourceKind = GeometryKernelExactBodyArtifact["sourceKind"];
export type ExactArtifactCacheIdentity = Pick<
  GeometryKernelExactBodyArtifact,
  | "bodyId"
  | "sourceType"
  | "documentSourceIdentity"
  | "bodySourceIdentitySignature"
  | "sourceCacheKeySha256"
  | "sourceGraphNodeCount"
  | "units"
  | "shapePolicy"
>;

export interface ExactArtifactCacheCandidate {
  readonly sourceKind: ExactTopologySourceKind;
  readonly shapePolicy: ExactBodyArtifactShapePolicy;
  readonly brepFormat: "occt-brep";
  readonly brepWriter: "BRepTools.Write_3";
  readonly brepBytes: Uint8Array;
  readonly brepByteLength: number;
  readonly brepSha256: string;
  readonly topologySignature: string;
}

export type ExactArtifactCacheMissReason =
  | "absent"
  | "unavailable"
  | "permission-denied"
  | "corrupt"
  | "version-mismatch"
  | "stale"
  | "storage-full"
  | "storage-error";

export type ExactArtifactCacheReadResult =
  | {
      readonly status: "hit";
      readonly artifact: GeometryKernelExactBodyArtifact;
    }
  | {
      readonly status: "miss";
      readonly reason: ExactArtifactCacheMissReason;
    };

export type ExactArtifactCacheWriteResult =
  | {
      readonly status: "stored";
      readonly evictedEntryCount: number;
      readonly entryCount: number;
      readonly byteLength: number;
    }
  | {
      readonly status: "skipped";
      readonly reason:
        | Exclude<ExactArtifactCacheMissReason, "absent">
        | "too-large";
    };

export type ExactArtifactCacheClearResult =
  | { readonly status: "cleared" }
  | {
      readonly status: "unavailable" | "failed";
      readonly reason: "unavailable" | "permission-denied" | "storage-error";
    };

export interface ExactArtifactOpfsCache {
  readonly read: (input: {
    readonly identity: ExactArtifactCacheIdentity;
    readonly isCurrent: () => boolean;
    /** Parses the candidate through OCCT and returns freshly recomputed evidence. */
    readonly validate: (
      candidate: ExactArtifactCacheCandidate
    ) => Promise<GeometryKernelExactBodyArtifact>;
  }) => Promise<ExactArtifactCacheReadResult>;
  readonly write: (input: {
    readonly artifact: GeometryKernelExactBodyArtifact;
    readonly isCurrent: () => boolean;
  }) => Promise<ExactArtifactCacheWriteResult>;
  readonly clear: () => Promise<ExactArtifactCacheClearResult>;
}
