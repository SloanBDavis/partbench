import {
  prepareBrowserStepPartition,
  type OcctStepPlacement,
  type OcctStepImportInput
} from "@web-cad/geometry-kernel/browser";
self.onmessage = async (
  event: MessageEvent<
    OcctStepImportInput & { compiledModule: WebAssembly.Module }
  >
) => {
  try {
    const result = await prepareBrowserStepPartition(
      event.data,
      (part, checkpoint, assembly) => {
        const display = checkpoint.display?.displayMesh;
        if (!display) return;
        const definitions = new Map(
          assembly.definitions.map((definition) => [definition.id, definition])
        );
        const meshes: {
          positions: Float32Array;
          indices: Uint32Array;
          name: string;
          transform: OcctStepPlacement;
        }[] = [];
        // One immutable definition buffer serves every placed occurrence.
        const positions = display.positions.slice();
        const indices = display.indices.slice();
        const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
        const active = new Set<string>();
        let visited = 0;
        const visit = (
          occurrence: (typeof assembly.roots)[number],
          parent: readonly number[]
        ) => {
          if (++visited > 100_000 || active.has(occurrence.definitionId))
            throw new Error("STEP display assembly is cyclic or too large.");
          const local = occurrence.transform;
          const matrix = Array.from({ length: 12 }, (_, i) => {
            const row = Math.floor(i / 4) * 4,
              column = i % 4;
            return (
              parent[row]! * local[column]! +
              parent[row + 1]! * local[column + 4]! +
              parent[row + 2]! * local[column + 8]! +
              (column === 3 ? parent[row + 3]! : 0)
            );
          });
          const definition = definitions.get(occurrence.definitionId);
          if (definition) {
            active.add(occurrence.definitionId);
            for (const child of definition.components) visit(child, matrix);
            active.delete(occurrence.definitionId);
          } else if (occurrence.definitionId === part.definitionId) {
            meshes.push({
              positions,
              indices,
              name: occurrence.name,
              transform: matrix as unknown as OcctStepPlacement
            });
          }
        };
        for (const root of assembly.roots) visit(root, identity);
        self.postMessage(
          {
            progress: {
              meshes,
              solidCount:
                meshes.length * checkpoint.metadata.topologyCounts.solidCount
            }
          },
          {
            transfer: [positions.buffer, indices.buffer]
          }
        );
      },
      event.data.compiledModule
    );
    const buffers = new Set<ArrayBuffer>();
    for (const part of result.prepared.parts)
      buffers.add(part.brepBytes.buffer as ArrayBuffer);
    for (const checkpoint of result.checkpoints)
      if (checkpoint) buffers.add(checkpoint.brepBytes.buffer as ArrayBuffer);
    for (const checkpoint of result.checkpoints) {
      const display = checkpoint?.display;
      if (!display) continue;
      buffers.add(display.displayMesh.positions.buffer as ArrayBuffer);
      buffers.add(display.displayMesh.indices.buffer as ArrayBuffer);
      if (display.viewportPickMap)
        for (const value of [
          display.viewportPickMap.faceTriangleRanges,
          display.viewportPickMap.edgePointRanges,
          display.viewportPickMap.edgePoints,
          display.viewportPickMap.vertexPoints
        ])
          buffers.add(value.buffer as ArrayBuffer);
    }
    self.postMessage({ result }, { transfer: [...buffers] });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
