# NNUE Weights Strategy

## Selected Strategy
**Option 3 (Placeholder-enhanced evaluator for v1.0) + Option 4 (Training Pipeline for v2.0).**

At v1.0, the engine will use a clean-room Rust placeholder evaluator for the `nnue` path, clearly indicating its status as `"weights_status": "placeholder"`. The backend architecture is configured to safely attempt to load a real NNUE binary from `NNUE_WEIGHTS_PATH`, and cleanly fallback to the placeholder if absent or invalid.

For v2.0, we will construct a custom training pipeline to produce a 100% legally clear, proprietary `.nnue` binary weight file optimized for Clash of Crowns.

## Why Selected
Using existing open-source NNUE weights (such as Stockfish's weights) carries the extreme risk of GPL-v3 license contamination. Our engine logic needs to remain safely proprietary or independent. Since we do not yet have a custom-trained `.nnue` file, the safest path is to establish the complete architectural hook (the weight loader) but rely on a robust placeholder until our custom training is complete.

## Licensing Safety
- **High / Clean**. By deferring real weights until we can train them internally, we avoid all risk of accidentally embedding GPL material into the app backend. 

## Integration Difficulty
- **Medium**. The weight loader logic exists and is verified in v1.0, making the actual drop-in for v2.0 trivial (just placing the file and setting the environment variable). The challenge lies strictly in orchestrating the future training process.

## Expected Strength
- **v1.0**: The `placeholder` NNUE route will perform slightly better than Beginner `hce` due to full Piece-Square Table expansion (including King, Queen, Rook) and a more sophisticated Negamax implementation, but it will *not* reach true Grandmaster strength.
- **v2.0**: Once real weights are dropped in, the engine will play at Master/Grandmaster strength depending on the noise tuning.

## Remaining Risks
- **Bot Strength Gap**: Intermediate through Grandmaster bots will temporarily lack the profound positional understanding a true neural network provides. The `errorNoiseCp` tuning will still distinguish them, but their peak tactical ceiling is artificially lowered in v1.0.
- **Weights Integration Match**: We must ensure that our v2.0 training outputs a binary matching the dimensions our Rust model loader expects (768 -> 256 -> 32 -> 1).
