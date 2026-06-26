# NNUE Promotion Decision

**Candidate:** `clash-of-crowns-v2-small.nnue`
**Weights Status:** trained
**Model Stage:** v2_small_candidate
**Promoted to testing:** NO
**Promoted to production:** NO

## Reason
The `v2_small` model failed the Benchmark Gate. While it successfully matched the placeholder Engine in 9 out of 10 positions (and correctly loaded using the Rust native NNUE loader without crashing), it failed on a critical tactical test:

- **Mate in 1**: Missed the expected `d8h4` mate in 1 move, playing `e5f4` instead.

Per the promotion rules, any model that misses an obvious Mate in 1 cannot be promoted to production or testing.

## What needs fixing
- **Dataset Size**: The current dataset contains only 72 labeled positions, which is vastly insufficient for training a robust neural network.
- **Model Quality**: Due to the small dataset, the model acts as a proof-of-concept pipeline rather than a generalized chess evaluator.
- **Next Steps**: We must scale up self-play generation and deeper labeling to hundreds of thousands of positions before training `v2_full` to ensure the network grasps basic tactical patterns and checkmates.
