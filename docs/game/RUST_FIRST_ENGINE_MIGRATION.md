# Rust-First Engine Migration

## Overview
Clash of Crowns has successfully transitioned to a **Rust-first** engine architecture. All raw chess evaluation and search logic previously housed in TypeScript (`hceEngine.ts`, `hceAdapter.ts`, `pst.ts`) has been entirely removed from the frontend codebase.

TypeScript now exclusively acts as an orchestrator layer. It receives user inputs, determines the bot profile, and routes the search request to the Rust backend (`/engine/move` and `/engine/simulate`).

## Architecture Routing
The unified Rust Engine endpoint `VITE_RUST_ENGINE_URL/engine/move` supports the `engine_type` parameter, which determines the evaluation logic and returns the `engine_used` and `weights_status` to ensure transparency.

### Engine Types

| Tier | Engine Type | Evaluator | Weights Status | Notes |
|------|-------------|-----------|----------------|-------|
| Beginner / Learner / Core | `hce` | Hand-Crafted Evaluation (PST) | `not_applicable` | Basic values, restricted PST. Error noise applied. |
| Intermediate -> GM | `nnue` | Neural Network Placeholder | `placeholder` | Will be replaced with real trained weights. |
| Stockfish | `benchmark` | Stockfish binary | N/A | Strictly used for validation/benchmark mode. |

## HCE PST Scope
The Rust Hand-Crafted Evaluator (`hce.rs`) relies exclusively on:
1. Material piece values (pawn=100, knight=320, bishop=330, rook=500, queen=900, king=20000).
2. Piece-Square Tables (PST) for **Pawns**, **Knights**, and **Bishops**.
Rooks, Queens, and Kings do not possess a PST in HCE, adhering to the basic beginner-friendly evaluation criteria.

## NNUE Weights Honesty
To preserve integrity in testing and production, the backend returns `"weights_status": "placeholder"` when `engine_type="nnue"` is utilized. We **do not fake** real NNUE weights. A dummy evaluation is used to prevent crashes, but it explicitly acknowledges its placeholder status. 

## Stockfish Benchmark
Stockfish is explicitly omitted from primary bot pathways. `StockfishBenchmarkAdapter` only initiates when explicitly in benchmark mode, preventing any chance of it becoming the primary engine.

## Remaining Blockers
1. **Real trained NNUE weights**: The neural network must be trained on high-elo gameplay and its binary integrated into `nnue.rs` for Intermediate->Grandmaster tiers to function at intended strength.
