# Open CASCADE browser runtime

`partbench-occt.js` and `partbench-occt.wasm` are built from
opencascade.js 2.0.0-beta.b5ff984 and Open CASCADE Technology 7.6.2
(commit bb368e271e24f63078129283148ce83db6b9670a).

Open CASCADE Technology: Copyright (c) Open CASCADE SAS and contributors.
opencascade.js: Copyright (c) Donal Fellmann and contributors.

Distributed under the GNU Lesser General Public License version 2.1;
OCCT's additional exception is in `OCCT_LGPL_EXCEPTION.txt`.
See `LICENSE_LGPL_21.txt` and [sources and rebuild instructions](../build/README.md).

Partbench selects the exposed JavaScript bindings and recompiles the native
hot paths listed in the build recipe with `-O3`; other SDK bitcode stays at `-Os`.
It does not modify the OCCT geometry algorithms or numeric tolerances.
