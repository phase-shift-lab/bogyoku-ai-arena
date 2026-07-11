# Third-party notices

| Component             | Use                     | License and source status                                                                                                    |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| React / React DOM     | UI runtime              | MIT; exact versions in `package-lock.json`                                                                                   |
| Vite                  | build tooling           | MIT; exact version in `package-lock.json`                                                                                    |
| shogiops 0.21.0       | legal shogi logic       | GPL-3.0-or-later; `https://github.com/WandererXII/shogiops`                                                                  |
| YaneuraOu             | bundled USI WASM engine | GPL-3.0; official revision `1308ab3803e0011979473296741e56a6981c46ba`; source, patch, build and hashes in `ENGINE_SOURCE.md` |
| Evaluation model      | position evaluation     | No external model bundled; compiled Material level 1 only; see `MODEL_LICENSE.md`                                            |
| Custom board          | board UI                | Original project code; no board UI dependency                                                                                |
| System Japanese fonts | typography              | Locally installed fonts only; no web-font request or bundled font file                                                       |

Redistributors of the bundled YaneuraOu WASM/JavaScript must preserve applicable notices and satisfy the GPL source-availability obligations for the exact engine source and patch. Dependency licenses should also be reviewed from the exact lockfile at release time. This document is not legal advice.
