import type {
  WcadTopologyCheckpointPayload,
  WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
export function createWcadTopologyCheckpointPayloadInputCache(
  payloads: readonly WcadTopologyCheckpointPayload[] | undefined
): readonly WcadTopologyCheckpointPayloadInput[] {
  return (
    payloads?.map((payload) => ({
      checkpointId: payload.checkpointId,
      bodyId: payload.bodyId,
      ...(payload.sourceFeatureId
        ? { sourceFeatureId: payload.sourceFeatureId }
        : {}),
      units: payload.manifestEntry.units,
      kernel: payload.manifestEntry.kernel,
      tolerance: payload.manifestEntry.tolerance,
      brepByteLength: payload.manifestEntry.brep.byteLength,
      brepSha256: payload.manifestEntry.brep.sha256,
      brepBytes: payload.brepBytes,
      topologyBytes: payload.topologyBytes,
      signatureBytes: payload.signatureBytes
    })) ?? []
  );
}
