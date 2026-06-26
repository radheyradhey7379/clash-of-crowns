# NNUE Dataset Generator & Tools

This folder contains utilities to define, generate, and validate JSONL datasets for the NNUE training pipeline.

## Files
- `schema.json`: The formal JSON schema defining a valid dataset row.
- `validate_dataset.py`: Python utility to validate an existing `.jsonl` file against the rules.
- `mock_positions.jsonl`: A tiny stub dataset used exclusively to test the pipeline scaffolding.

## Constraints
We explicitly DO NOT scrape or download external PGN or NNUE datasets automatically to ensure we remain 100% compliant with copyright and GPL restrictions. All datasets must be generated internally or manually audited.
