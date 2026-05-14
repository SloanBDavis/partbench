# Renderer Mesh Bridge

This package is an isolated spike bridge from geometry-worker mesh output to the current renderer-facing mesh shape.

It accepts `SerializableMeshData` from `@web-cad/geometry-kernel` or a `GeometryWorkerSpikeResponse` from `@web-cad/geometry-worker-spike`, validates the typed-array payload, copies it into serializable renderer vertices and triangle indices, and returns a generic `RenderTriangleMesh`.

To display the result in the current app stack, pass `result.mesh` into
`renderCanvasScene({ meshes: [...] })` or the web app `ViewportCanvas` `meshes`
prop. The normal web app does not mount an OCCT-backed mesh button yet because
the current OCCT spike still has browser-bundling risk; mesh display support is
available without making app startup depend on that worker path.

The bridge is not the production renderer/cache design. Production geometry caching should eventually track document object revisions, derived mesh invalidation, worker lifecycle, memory pressure, and renderer-specific buffer ownership. This package only proves that mesh data from the spike can cross the worker boundary and become a derived viewport input without making `cad-core` depend on geometry or rendering internals.
