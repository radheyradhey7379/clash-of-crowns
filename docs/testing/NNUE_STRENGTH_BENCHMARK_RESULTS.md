# NNUE Strength Benchmark Results

## Process Lifecycle Verification

- **Phase**: Placeholder / HCE
  - Port Used: `57926`
  - Process ID: `4572`
  - Engine Mode Used: `hce_test=hce | nnue_test=nnue`
  - Weights Status: `placeholder`
  - Inference Mode: `placeholder`
  - Cleanup Succeeded: `YES`

- **Phase**: Trained NNUE
  - Port Used: `58134`
  - Process ID: `11988`
  - Engine Mode Used: `nnue`
  - Weights Status: `trained`
  - Inference Mode: `tensor`
  - Cleanup Succeeded: `YES`

## Benchmark Runs

| Test Case | FEN | HCE Move | Placeholder Move | NNUE Move | Status |
|---|---|---|---|---|---|
| Fools Mate | `rnbqkbnr/pppp1p...` | d8h4 | d8h4 | d8h4 | Found expected move |
| Scholars Mate | `r1bqkbnr/pppp1p...` | f3f7 | f3f7 | f3f7 | Found expected move |
| Back Rank | `6k1/5ppp/8/8/8/...` | e1e8 | e1e8 | e1e8 | Found expected move |
| Smothered | `6rk/6pp/8/4N3/8...` | e5f7 | e5f7 | e5f7 | Found expected move |
| Arabian 2 | `7k/R7/5N2/8/8/8...` | a7h7 | a7h7 | a7h7 | Found expected move |
| Queen + King | `8/8/8/8/8/1K6/2...` | c2c1 | c2c1 | c2c1 | Missed expected c2b2 |
| Two Rooks | `6k1/5ppp/8/8/8/...` | c1c8 | c1c8 | c1c8 | Found expected move |
| Anastasia-like | `6k1/R7/8/8/8/8/...` | c1c8 | c1c8 | c1c8 | Found expected move |
| Boden | `2kr3r/pp2nppp/2...` | d8d1 | d8d1 | d8d1 | Found expected move |
| Arabian | `7k/R7/5N2/8/8/8...` | a7h7 | a7h7 | a7h7 | Found expected move |
| Hanging Queen 1 | `8/8/8/3q4/8/3Q4...` | d3d5 | d3d5 | d3d5 | Found expected move |
| Hanging Queen 2 | `8/8/8/8/4Q3/8/4...` | e2b2 | e2b2 | e2b2 | Missed expected e2e4 |
| Hanging Queen 3 | `r1bqkbnr/pppppp...` | d4e2 | d4e2 | d4c2 | Missed expected d4e2 |
| Hanging Queen 4 | `rnb1kbnr/pppppp...` | d4c6 | d4c6 | d4c6 | Found expected move |
| Hanging Queen 5 | `8/8/8/8/4q3/4R3...` | e3e4 | e3e4 | e3e4 | Found expected move |
| Hanging Rook 1 | `8/8/8/8/3R4/8/3...` | d4d2 | d4c4 | d4d2 | Found expected move |
| Hanging Rook 2 | `8/8/8/8/4r3/8/4...` | e4e2 | e4e2 | e4e2 | Found expected move |
| Hanging Rook 3 | `4k3/4r3/8/8/8/8...` | e2e7 | e2e7 | e2e7 | Found expected move |
| Hanging Rook 4 | `rnbqkbnr/1ppppp...` | a8a1 | a8a1 | a8a1 | Found expected move |
| Hanging Rook 5 | `k7/8/8/8/8/3R4/...` | d3d2 | d3d2 | d3d2 | Found expected move |
| Knight Fork 1 | `8/2k1q3/8/8/8/4...` | e3d5 | e3d5 | e3d5 | Found expected move |
| Knight Fork 2 | `8/8/4n3/8/8/8/2...` | e6d4 | e6d4 | e6d4 | Found expected move |
| Knight Fork 3 | `8/8/2k1r3/8/8/4...` | e3f5 | e3f5 | e3d1 | Missed expected e3d5 |
| Knight Fork 4 | `8/8/4n3/8/8/2K1...` | e6f4 | e6f4 | e6d4 | Found expected move |
| Knight Fork 5 | `r1bqkbnr/pppp1p...` | e5c6 | d2d4 | e5c6 | Found expected move |
| Fork 6 | `8/2k1q3/8/8/8/3...` | d3f2 | d3f2 | d3c1 | Missed expected d3f4 |
| Fork 7 | `8/8/3n4/8/8/2K1...` | d6e4 | d6f5 | d6e4 | Missed expected d6f5 |
| Fork 8 | `8/2r1k3/8/8/8/3...` | d3f4 | h1g1 | d3c1 | Missed expected d3b4 |
| Fork 9 | `8/8/3n4/8/8/2R1...` | d6f5 | d6f5 | d6c4 | Missed expected d6b5 |
| Fork 10 | `8/4k3/8/2q5/8/3...` | d3e4 | d3f1 | d3b1 | Missed expected d3f5 |
| Promotion 1 | `8/3P4/8/8/8/8/K...` | d7d8q | d7d8q | d7d8q | Found expected move |
| Promotion 2 | `8/4P3/8/8/8/8/K...` | e7e8q | e7e8q | e7e8q | Found expected move |
| Promotion 3 | `8/5P2/8/8/8/8/K...` | f7f8q | f7f8q | f7f8q | Found expected move |
| Promotion 4 | `8/6P1/8/8/8/8/K...` | g7g8q | g7g8q | g7g8q | Found expected move |
| Promotion 5 | `8/7P/8/8/8/8/K1...` | h7h8q | h7h8q | h7h8q | Found expected move |
| Promotion 6 | `8/K1k5/8/8/8/8/...` | d2d1q | d2d1q | d2d1q | Found expected move |
| Promotion 7 | `8/K1k5/8/8/8/8/...` | e2e1q | e2e1q | e2e1q | Found expected move |
| Promotion 8 | `8/K1k5/8/8/8/8/...` | f2f1q | f2f1q | f2f1q | Found expected move |
| Promotion 9 | `8/K1k5/8/8/8/8/...` | g2g1q | g2g1q | g2g1q | Found expected move |
| Promotion 10 | `8/K1k5/8/8/8/8/...` | h2h1q | h2h1q | h2h1q | Found expected move |
| Defensive 1 | `rnbqkbnr/pppp1p...` | b1c3 | b1c3 | a2a3 | Missed expected d2d4 |
| Defensive 2 | `r1bqkbnr/pppp1p...` | b1c3 | b1c3 | a2a3 | Missed expected d2d4 |
| Defensive 3 | `r1bqkbnr/pp1p1p...` | b1c3 | b1c3 | a2a3 | Missed expected d2d4 |
| Defensive 4 | `r1bqkbnr/pp1p1p...` | b1c3 | b1c3 | a2a3 | Missed expected d2d4 |
| Defensive 5 | `r1bqkbnr/pp1p1p...` | d4d5 | d4e5 | d4e5 | Found expected move |
| Defensive 6 | `r1bqkbnr/pp1p1p...` | c6e5 | c6e5 | c6e5 | Found expected move |
| Defensive 7 | `r1bqkbnr/pp1p1p...` | d2d3 | a2a3 | a2a3 | Missed expected d2d4 |
| Defensive 8 | `r1bqkbnr/pp1p1p...` | e5f3 | d8e7 | e5f3 | Found expected move |
| Defensive 9 | `r1bqkbnr/pp1p1p...` | g2f3 | g2f3 | g2f3 | Found expected move |
| Defensive 10 | `r1bqkbnr/pp1p1p...` | g8f6 | d8e7 | d8e7 | Missed expected g8f6 |
