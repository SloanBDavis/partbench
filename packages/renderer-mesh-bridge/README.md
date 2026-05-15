# Renderer Mesh Bridge

This package is an isolated adapter bridge from geometry-worker mesh output to the current renderer-facing mesh shape.

It accepts `SerializableMeshData` from `@web-cad/geometry-kernel` or a `GeometryWorkerResponse` from `@web-cad/geometry-worker`, validates the typed-array payload, copies it into serializable renderer vertices and triangle indices, and returns a generic `RenderTriangleMesh`.

To display the result in the current app stack, pass `result.mesh` into
`renderCanvasScene({ meshes: [...] })` or the web app `ViewportCanvas` `meshes`
prop. Local Vite serve mounts the derived OCCT mesh service by default; use
`VITE_DISABLE_DERIVED_GEOMETRY=true pnpm dev` to force primitive fallback.
Production builds remain opt-in with `VITE_ENABLE_DERIVED_GEOMETRY=true`.

The bridge is not the production renderer/cache design. Production geometry caching should eventually track document object revisions, derived mesh invalidation, worker lifecycle, memory pressure, and renderer-specific buffer ownership. This package adapts mesh data from the geometry worker into a derived viewport input without making `cad-core` depend on geometry or rendering internals.
