# Engine Strength Benchmark

This document summarizes the relative strength and evaluation behaviors of the three engine paths available in Clash of Crowns.

## 1. Hand-Crafted Evaluation (HCE)
- **Engine Type**: `hce`
- **Tiers**: Core, Beginner, Learner
- **Architecture**: Rust-based Negamax search with simple material counting and basic PSTs (Pawn, Knight, Bishop).
- **Strength**: Estimated 50 - 800 ELO.
- **Characteristics**: 
  - Misses long-term positional advantages.
  - Highly susceptible to `errorNoiseCp` (Beginner uses 150cp noise, making it drop pieces).
  - Fast execution time due to minimal evaluation overhead.
  - No King safety or complex pawn structure evaluation.

## 2. Placeholder NNUE (v1.0)
- **Engine Type**: `nnue`
- **Tiers**: Intermediate, Hard, Master, Grandmaster
- **Architecture**: Rust-based Negamax search using a placeholder fallback evaluator (Piece values + full PSTs + rudimentary King safety).
- **Strength**: Estimated 1000 - 1600 ELO.
- **Characteristics**:
  - Better positional play than `hce`.
  - Capable of deeper tactical combinations due to reduced branching factor in quiet positions and better sorting, although the evaluation function is still rudimentary.
  - Grandmaster tier runs at `errorNoiseCp = 0` and maximum depth, providing the strongest possible play for the current placeholder logic.
  - Expected to reach 2200+ ELO in v2.0 once real weights are trained and loaded.

## 3. Stockfish (Benchmark Only)
- **Engine Type**: `stockfish_benchmark`
- **Architecture**: WASM Stockfish running on the frontend.
- **Strength**: 3000+ ELO.
- **Role**: Strictly used for local testing, benchmarking, and theoretical evaluation comparisons. Not used in any live gameplay tier to ensure no GPL compliance issues in production and to maintain proprietary control of the game engine feel.

## Example Position Benchmarks

**Position 1 (Starting Position)**
- `hce`: +0.10 (White edge due to first move initiative in center)
- `nnue` (Placeholder): +0.15 
- `stockfish`: +0.30

**Position 2 (Complex Middlegame - Material Even)**
- `hce`: 0.00 (Only counts material and basic PST)
- `nnue` (Placeholder): +0.80 (Recognizes slightly better piece activity)
- `stockfish`: +1.20 (Understands deep positional dominance)

**Position 3 (Tactical Sequence - Mate in 3)**
- `hce`: Found if depth >= 5.
- `nnue` (Placeholder): Found if depth >= 5.
- `stockfish`: Found instantly.
