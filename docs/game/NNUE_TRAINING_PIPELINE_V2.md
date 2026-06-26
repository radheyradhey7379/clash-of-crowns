# v2.0 Proprietary NNUE Training Pipeline

## Overview
This document outlines the architecture, data formats, and training methodology for the custom NNUE model powering Clash of Crowns. The current phase establishes the scaffolding; real weights will be trained in a subsequent phase.

## 1. Target File Name
`clash-of-crowns.nnue`

## 2. Network Architecture (Rust Loader Compatibility)
The Rust NNUE loader currently anticipates the following standard dimensions:
- **Input Dimension**: `768` (6 piece types * 2 colors * 64 squares)
- **Hidden Dimension 1**: `256` (HalfKP architecture standard)
- **Hidden Dimension 2**: `32`
- **Output Dimension**: `1` (Evaluation in centipawns)

## 3. Input Feature Format
- **Format**: HalfKP (King-Piece) or standard 768-vector.
- For v1.0 pipeline scaffolding, we assume a standard 768 sparse array representation mapping directly from FEN strings.

## 4. Label Format
Labels are extracted directly from the dataset.
- `eval_cp`: integer representing centipawn evaluation (e.g., `+35`, `-110`).
- `best_move`: standard UCI format (`e2e4`, `g1f3`).

## 5. Dataset Source Strategy
- **Primary Source**: Self-play generated games from the Rust HCE engine.
- **Secondary Source**: Benchmarks against Stockfish to anchor evaluations.
- **Rules**: We will *not* scrape copyrighted material or import GPL datasets.

## 6. Training Script Flow
1. Load and parse `.jsonl` dataset.
2. Initialize PyTorch model matching the 768 -> 256 -> 32 -> 1 architecture.
3. Optimize via Adam/MSE loss against `eval_cp`.
4. Export weights to `.nnue` binary on completion.

## 7. Export Binary Format
The binary file will strictly follow this header structure to allow safe parsing in Rust:
- `[0..4]` bytes: Magic string/Version `0x00000001` (u32)
- `[4..8]` bytes: Input Dimension `768` (u32)
- `[8..12]` bytes: Hidden 1 Dimension `256` (u32)
- `[12..16]` bytes: Hidden 2 Dimension `32` (u32)
- `[16..20]` bytes: Output Dimension `1` (u32)
- `[20..24]` bytes: Checksum (u32)
- `[24..]` bytes: Dense f32 little-endian floats representing layer weights and biases.

## 8. Validation Method
- Validate checksum matching upon load.
- Validate tensor dimension bounds.
- Never panic on load failure.

## 9. Benchmark Method
- A dedicated benchmark script (`tools/nnue_benchmark/run_benchmark.py`) will automatically test the generated weights against 10 critical test FENs, outputting expected behaviors.

## 10. Deployment Method
- Final weights (`clash-of-crowns.nnue`) will be distributed alongside the backend binary or securely hosted for the app to download on initial boot.

## 11. Remaining Limitations
- Deep reinforcement learning (RL) self-play infrastructure is not yet implemented. The pipeline currently relies on static supervised learning datasets.
