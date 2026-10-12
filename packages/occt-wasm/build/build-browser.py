#!/usr/bin/env python3
"""Run inside the pinned opencascade.js build image; see README.md."""
import json
import concurrent.futures
import sys
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
OUTPUT = HERE.parent / "vendor"
BUILD = Path("/opencascade.js/build")
# Recompile the measured hot paths; the remaining SDK bitcode stays at -Os.
# No source algorithms, tolerances, exception behavior or fast-math changes.
# Keep this list aligned with the checked browser artifact and its evidence.
OPTIMIZED_PACKAGES = """Extrema math BRepCheck BndLib BRepBndLib
StepToTopoDS StepToGeom ShapeFix ShapeAnalysis GeomAdaptor BRepAdaptor
BSplCLib BSplSLib PLib""".split()
sys.path.insert(0, "/opencascade.js/src")
from Common import ocIncludePaths, additionalIncludePaths


def compile_source(source):
    target = BUILD / "sources" / source.relative_to("/occt/src")
    target = Path(str(target) + ".o")
    if not target.exists():
        return
    subprocess.run([
        "emcc", "-flto", "-fexceptions", "-sDISABLE_EXCEPTION_CATCHING=0",
        "-DIGNORE_NO_ATOMICS=1", "-DOCCT_NO_PLUGINS", "-frtti",
        "-DHAVE_RAPIDJSON", "-O3",
        *["-I" + path for path in ocIncludePaths + additionalIncludePaths],
        "-c", str(source), "-o", str(target)
    ], check=True)


with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    list(executor.map(compile_source, [
        source for package in OPTIMIZED_PACKAGES
        for source in (Path("/occt/src") / package).glob("*.cxx")
    ]))
config = json.loads((HERE / "browser-kernel.json").read_text())
symbols = {binding["symbol"] for binding in config["mainBuild"]["bindings"]}
bindings = [path for path in (BUILD / "bindings").rglob("*.cpp.o") if path.name[:-6] in symbols]
missing = symbols - {path.name[:-6] for path in bindings}
if missing:
    raise RuntimeError("Missing SDK bindings: " + ", ".join(sorted(missing)))
sources = [path for path in (BUILD / "sources").rglob("*.o") if path.name != "XBRepMesh.o"]
# Flags match the pinned SDK's customBuildSchema.py. No fast-math, tolerance,
# exception, validation or geometry changes.
subprocess.run([
    "emcc", "-lembind", *map(str, bindings), *map(str, sources),
    "-o", str(OUTPUT / config["mainBuild"]["name"]),
    "-flto", "-fexceptions", "-sDISABLE_EXCEPTION_CATCHING=0", "-O3",
    "-sEXPORT_ES6=1", "-sUSE_ES6_IMPORT_META=0", "-sEXPORTED_RUNTIME_METHODS=['FS']",
    "-sINITIAL_MEMORY=100MB", "-sMAXIMUM_MEMORY=4GB", "-sALLOW_MEMORY_GROWTH=1",
    "-sUSE_FREETYPE=1", "-sLLD_REPORT_UNDEFINED", "--no-entry"
], check=True)
