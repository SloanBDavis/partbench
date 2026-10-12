Partbench STEP display preview uses the unmodified occt-import-js 0.0.23
JavaScript/WebAssembly distribution, copyright Viktor Kovacs and contributors,
under LGPL-2.1. Its source and build scripts are available at:
https://github.com/kovacsv/occt-import-js/tree/0.0.23
https://www.npmjs.com/package/occt-import-js/v/0.0.23

That distribution includes Open CASCADE Technology, copyright Open CASCADE SAS,
under LGPL-2.1 with the OCCT exception. The upstream source submodule is pinned to:
https://github.com/Open-Cascade-SAS/OCCT/tree/d2abb6d844231cb8f29be6894440874a4700e4a5

The adjacent files contain the full license terms. The library is provided
without warranty. This preview library is separate from the exact editing kernel.
To rebuild/replace it, follow the upstream CMake/Emscripten build instructions,
replace its dist/occt-import-js.js and dist/occt-import-js.wasm in the dependency,
and rebuild Partbench with pnpm --filter @web-cad/web build. Partbench's source
and lockfile identify the import boundary and dependency version. The library is
not modified, statically merged into the authoritative kernel, or used as the
native document format. Reverse engineering to debug modifications of the
LGPL-covered library is permitted by its license.

The exact editing kernel and supported large STEP imports use a replaceable
browser build of opencascade.js 2.0.0-beta.b5ff984 / OCCT 7.6.2, under LGPL-2.1
with the OCCT exception. Copyright Donal Fellmann, Open CASCADE SAS and
contributors. Partbench selects the required bindings and recompiles selected
native hot paths with -O3, without changing geometry algorithms or tolerances.
Sources:
https://github.com/donalffons/opencascade.js/tree/b5ff984
https://github.com/Open-Cascade-SAS/OCCT/tree/bb368e271e24f63078129283148ce83db6b9670a
The pinned toolchain, complete binding list and rebuild recipe are in
packages/occt-wasm/build/ in the Partbench source distribution. Rebuild and
replace packages/occt-wasm/vendor/partbench-occt.js and partbench-occt.wasm,
then rebuild the application. The adjacent LGPL and OCCT exception apply;
reverse engineering for debugging modifications is permitted by those terms.
