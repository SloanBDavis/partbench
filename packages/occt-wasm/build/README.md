# Browser OCCT build

The browser uses the same OCCT 7.6.2 algorithms as the pinned
`opencascade.js@2.0.0-beta.b5ff984` SDK, with only the required JavaScript
bindings linked. The Node SDK remains available for independent interchange
comparison. Geometry tolerances, exceptions and validation are unchanged.

Sources and toolchain:

- [opencascade.js b5ff984](https://github.com/donalffons/opencascade.js/tree/b5ff984)
- [OCCT bb368e271e24f63078129283148ce83db6b9670a](https://github.com/Open-Cascade-SAS/OCCT/tree/bb368e271e24f63078129283148ce83db6b9670a)
- Emscripten 3.1.14, supplied by the SDK image below.
- Binding selection: `browser-kernel.json`. Add bindings here when introducing
  a new OCCT API. The declaration shim uses the original SDK's types.
- `build-browser.py` recompiles the explicitly listed native hot paths with
  `-O3`, keeps the remaining SDK bitcode at `-Os`, and links with the SDK's
  existing `-O3` LTO flags. It makes no OCCT source or tolerance edits. A
  broader `-O3` rebuild regressed cold execution and was discarded.

From the repository root, on an x86-64 Docker host:

```sh
docker run --rm --cpus=3 --memory=12g \
  --mount type=bind,src="$PWD",dst=/src \
  --entrypoint python3 \
  -e EMCC_CORES=3 -e BINARYEN_CORES=3 \
  -e EMSDK_NODE=/emsdk/node/14.18.2_64bit/bin/node \
  donalffons/opencascade.js@sha256:3069f4c2e3ab62bb82d81843bad2c0f8552ee92373208f8f655ef9bf71c0524d \
  /src/packages/occt-wasm/build/build-browser.py
```

The first link may fetch the pinned Emscripten FreeType port. Managed networks
must supply their proxy and trusted CA through the environment; do not disable
certificate verification. The build writes the `.js` and `.wasm` files in
`../vendor`. Applications can substitute a rebuilt version at those paths.

Run `pnpm verify` and both existing engine interchange journeys after rebuilding.
Compare the browser's saved native file with the original SDK's headless output;
BRep payloads, canonical topology and occurrence placement must agree. Performance
acceptance uses five isolated production-browser runs, never concurrent builds.

OCCT and opencascade.js are LGPL 2.1; OCCT includes its additional exception.
Their license and exception texts are retained in `../vendor`. The source links,
build recipe and replaceable artifacts provide the corresponding rebuild path.
