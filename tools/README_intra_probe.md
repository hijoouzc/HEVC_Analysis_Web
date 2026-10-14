# HM intra probe

The trace hooks are integrated into the build system and enabled by default (`ENABLE_VISUAL_DUMP=ON`). Build the probe target using CMake:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --target TAppEncoderIntraProbe -j$(nproc)
```

From the repository root, find the executable (its compiler-version directory depends on the local toolchain), then select a CTU by its zero-based grid coordinates:

```bash
find bin/umake -name TAppEncoderIntraProbe -type f
PROBE_BIN=$(find bin/umake -name TAppEncoderIntraProbe -type f -print -quit)
VISUAL_CTU_X=4 VISUAL_CTU_Y=4 VISUAL_CU_SIZE=8 \
VISUAL_PU_X=64 VISUAL_PU_Y=64 \
VISUAL_OUTPUT_DIR=tools/intra_probe_dump \
"$PROBE_BIN" \
  -c cfg/encoder_intra_main.cfg -c cfg/intra_probe_racehorses.cfg
```

`VISUAL_CTU_X/Y` select a CTU, while `VISUAL_CU_SIZE` filters intra PUs by width. A CTU can contain multiple PUs of that size. To select one exact PU, also set `VISUAL_PU_X/Y` to its luma pixel origin, for example `(64,64)`. The transform trace then includes TUs owned by the CU at that position and size. Transform records include candidate evaluations at the selected CU, not only the final winning mode. Each run replaces `trace.jsonl` and `intra_probe_run.log`.

The `INTRA_FAST_MODE` event is the first-pass mode-pruning measurement in `TEncSearch::estIntraPredLumaQT`: Hadamard distortion plus mode-bit cost. It is not the final full-RD winner. `TRANSFORM_QUANT` records the owning CU coordinates, size, depth, prediction mode, intra mode, TU depth, residual, transform coefficients, and quantized coefficients. Match an intra transform to its fast-mode candidate using the same CU/PU origin and intra mode. Transform records are emitted only for TUs owned by the selected CU, but include candidate evaluations for multiple intra modes and TU splits; they do not identify the final winning mode by themselves. The final selected partition tree is emitted for the selected CTU only.

To visualize the completed run, generate a self-contained HTML report and open it in a browser:

```bash
python3 tools/intra_probe_visualize.py tools/intra_probe_dump/trace.jsonl
xdg-open tools/intra_probe_dump/report.html
```

The report presents the reference samples, fast-mode ranking, prediction/residual matrices by mode, transform/quantization trials by mode, and the final CU tree. It uses only Python's standard library and the browser; it does not change encoder decisions.
