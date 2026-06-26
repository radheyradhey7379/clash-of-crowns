# NNUE v2_full Dataset Plan

## Objective
To train a robust NNUE engine (`v2_full`) capable of achieving 1800+ Elo by scaling the dataset to 1M+ high-quality positions evaluated using Stockfish. The dataset must cover all phases of the game, with special emphasis on sharp tactical positions to overcome the horizon effect and tactical blindness observed in `v2_medium`.

## Composition Strategy (1M+ Positions)

1. **Tactics (10% - 100,000 positions)**
   - **Source**: Lichess Puzzles database / synthesized FENs.
   - **Purpose**: Teach the NNUE to recognize hanging pieces, forks, pins, and checkmates natively, reducing reliance on deep search for basic tactics.
   - **Generation**: Parse CSV of Lichess puzzles, apply random valid prior moves, or synthesize using python-chess.

2. **Openings (30% - 300,000 positions)**
   - **Source**: ECO (Encyclopedia of Chess Openings) book, or high-ELO PGN databases.
   - **Purpose**: Prevent early-game blunders and establish strong positional understanding of pawn structures and piece activity.
   - **Generation**: Extract the first 15-20 plies of Grandmaster games.

3. **Midgame / Endgame Random Walks (60% - 600,000 positions)**
   - **Source**: Self-play or randomized engine walks.
   - **Purpose**: General evaluation capability. Exposing the model to sub-optimal, noisy, and highly varied positions prevents over-fitting to perfect play.
   - **Generation**: Play games between two HCE engines or random engines with noise injected. Extract FENs at various plies.

## Pipeline Architecture

Generating and labeling 1M+ positions is computationally expensive. We will use the following pipeline:

1. **Generation (Rust or Python)**:
   - Use `generate_selfplay.py` and `generate_tactics.py` with multi-processing to quickly write raw FENs to `data/nnue/raw/`.
   - Chunk the output into multiple `jsonl` files (e.g., `batch_001.jsonl`).

2. **Labeling (Python + Stockfish)**:
   - **Tool**: `label_positions.py` using `python-chess` and the official Stockfish binary.
   - **Concurrency**: Use `concurrent.futures.ThreadPoolExecutor` to run multiple Stockfish instances simultaneously.
   - **Thresholds & Depth**:
     - **Depth**: Minimum Depth 12. This is the sweet spot where Stockfish sees clearly through basic tactics but remains fast enough to label ~100+ positions per second across multiple cores.
     - **Time Limit**: Max 1-2 seconds per position to prevent hanging on complex positions.
     - **Mate Scores**: Standardized to `+20000` / `-20000` to aggressively penalize checkmates.

3. **Filtering & Preparation**:
   - `filter_dataset.py` drops duplicate FENs.
   - Shuffle the dataset to ensure mini-batches during training contain a mix of game phases.

## Hardware Utilization
- The labeling process is CPU-bound. 
- Using a 16-core CPU, we can spawn 12-16 Stockfish workers, generating ~50,000 labeled positions per hour.
- 1M positions will take approximately 20 hours of continuous labeling. We will incrementally train on smaller subsets (e.g. 100k, 250k) to validate progress before completing the full 1M.
