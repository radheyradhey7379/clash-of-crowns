# Python / Rust NNUE Consistency Test

**Overall Status**: PASS

| FEN | PyTorch Eval | Rust Eval (centipawns) | Absolute Diff | Status |
|---|---|---|---|---|
| `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 0.0424 | 0 | 0.0424 | PASS |
| `rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2` | 0.0473 | 0 | 0.0473 | PASS |
| `r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3` | 0.0456 | 0 | 0.0456 | PASS |
| `r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5` | 0.0473 | 0 | 0.0473 | PASS |
| `4k3/8/8/8/8/8/8/4K3 w - - 0 1` | 0.0381 | 0 | 0.0381 | PASS |
| `3r4/8/8/8/8/8/8/3R4 w - - 0 1` | 0.0397 | 0 | 0.0397 | PASS |
