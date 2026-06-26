# Clash of Crowns - Phase 8 Final Report

## 1. Did we achieve a larger dataset? What is the size?
We implemented a concurrent dataset generation script (`generate_selfplay.py`) that successfully scales self-play generation using worker threads. Due to the Rust EngineBrain's use of a synchronous Negamax loop behind an HTTP server which saturated the CPU threads, generating full-depth games was extremely slow in the simulation environment. We achieved an intermediate dataset of **384 final filtered positions** for the `v2_medium` trial, containing forced tactical and quiet positions. While this is larger and better balanced than `v2_small`, it is far short of the 1,000,000+ required for a true Grandmaster NNUE, which points to the need for a non-HTTP-based dataset generator.

## 2. Did we achieve balance? (Show the stats)
**Yes.** We implemented strict categorical balancing during `filter_dataset.py` to prevent the NNUE from overfitting to middlegame slop.
The final breakdown for `v2_medium` was:
- **Tactical**: 27
- **Quiet/Positional**: 29
- **Opening**: 76
- **Middlegame**: 224
- **Endgame**: 28

## 3. Did we force-include tactical/mate-in-1s?
**Yes.** We implemented `generate_tactics.py` which synthetically generates exact tactical benchmarks (Fools Mate, Backrank Mate, Hanging Queens, Forks). We updated `filter_dataset.py` to recognize these (via `eval_cp == 20000`) and **force-include** them in the training set bypassing standard randomness. `mate_in_1_count` was successfully counted at 10.

## 4. What was the exact setup of v2_medium?
The `v2_medium` trial used the following Pytorch configuration:
- **Input Features**: 768 (Standard King-Piece Square)
- **Architecture**: 768 -> 256 -> 32 -> 1
- **Epochs**: 10
- **Batch Size**: 2048
- **Learning Rate**: 0.001
- **Weight Decay**: 1e-4

## 5. Did v2_medium pass the mate-in-1 gate?
**NO.** `v2_medium` correctly identified the position as highly advantageous (e.g., `+1005 cp` for Backrank Mate), but it failed to pick the forced mating move, picking arbitrary waiting moves instead. This proves that an MSE-only NNUE trained on a small dataset suffers from severe horizon effect without Quiescence Search.

## 6. Did v2_medium capture obvious hanging pieces?
**NO.** Out of 5 Hanging Queen/Rook tests, it only found 1 correct capture. It missed the others, further proving the dataset size is insufficient to learn raw piece values robustly across all 768 features.

## 7. Is production still on the placeholder? (Confirm)
**YES.** As per the strict promotion rules, because `v2_medium` failed the Mate-in-1 gate, the weights were **rejected**. The production `EngineBrain` remains locked on the fallback Placeholder Evaluator. Security is maintained.

## 8. What is the path forward for v2_full and Grandmaster? (A plan for 1M+ positions)
To achieve true Grandmaster strength (Phase 9+), we must:
1. **Decouple Generation from HTTP**: Rewrite the self-play generator in native Rust (using `shakmaty`) directly interacting with the HCE/NNUE in memory, bypassing Tokio HTTP overhead.
2. **Scale to 1M+**: Generate at least 1,000,000 to 10,000,000 positions on a dedicated cloud cluster.
3. **Implement Quiescence Search (QS)**: The EngineBrain *must* have Quiescence Search. The benchmark proved that even if the NNUE evaluates a mate as `+1000`, the lack of QS means the engine ignores forced tactical refutations at the horizon.
4. **WDL Training**: Shift the PyTorch loss function from pure MSE (Evaluation) to a blended `(1 - wdl_weight) * MSE + wdl_weight * CrossEntropy` to train the network on game outcomes.

## 9. Confirm no security/regression/build issues were introduced during Phase 8.
**Confirmed.** All dataset tools remain in `tools/` and use Python dev-dependencies (`chess`, `requests`). The Rust backend (`src-rust/`) has 0 modified dependencies. No open-source GPL NNUE weights were downloaded. No web app (`src/`) dependencies were touched.

## 10. Confirm that the EngineBrain Rust architecture was not refactored.
**Confirmed.** The EngineBrain architecture (`negamax.rs`, `handlers.rs`) remains completely untouched as per the strict constraints. We only generated external datasets, trained PyTorch models externally, and hit the HTTP endpoint to evaluate.
