# NNUE Training Pipeline

This folder contains the Python scaffolding for training the custom `clash-of-crowns.nnue` model. 
This is currently a foundation scaffold and does not require a GPU or massive dataset to test.

## Scripts
- `model.py`: PyTorch definition of the 768->256->32->1 network.
- `train.py`: The entrypoint to train the model on a `.jsonl` dataset.
- `export_weights.py`: Utility to serialize the trained PyTorch weights into the custom binary format expected by the Rust backend.

## Usage (Mock Pipeline)
```bash
python train.py --dataset ../nnue_dataset/mock_positions.jsonl --epochs 2 --out /tmp/clash-of-crowns-test.nnue
```
