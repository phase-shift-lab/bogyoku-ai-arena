# Benchmark protocol

Release verification currently proves functional startup and interaction; it does not claim comparative engine performance.

Any published benchmark must record:

- device, OS, browser version, logical cores, and memory class;
- runtime variant, Threads, Hash, engine SHA-256, and the absence/presence of an external model;
- fixed SFEN suite and identical per-position search limit;
- nodes, elapsed time, nodes/second, peak observed memory, timeouts, and failures;
- warm-up method, run count, median, and dispersion.

Threaded and single-thread results must be reported separately. Do not compare runs with different search limits or silently exclude failures. Store the exact SFEN suite and raw browser output beside any result table so another operator can reproduce it.
