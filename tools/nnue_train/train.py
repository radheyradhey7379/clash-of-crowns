import argparse
import sys
import json
import os
import csv
from model import NnueModel
from export_weights import export_to_nnue

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import Dataset, DataLoader
except ImportError:
    print("PyTorch not installed. Install via `pip install torch`.")
    sys.exit(1)

PIECE_MAP = {
    'P': 0, 'N': 1, 'B': 2, 'R': 3, 'Q': 4, 'K': 5,
    'p': 6, 'n': 7, 'b': 8, 'r': 9, 'q': 10, 'k': 11
}

def fen_to_tensor(fen):
    t = torch.zeros(768, dtype=torch.float32)
    board_part = fen.split(" ")[0]
    ranks = board_part.split("/")
    for r_idx, rank in enumerate(ranks):
        rank_idx = 7 - r_idx
        f_idx = 0
        for char in rank:
            if char.isdigit():
                f_idx += int(char)
            else:
                p_idx = PIECE_MAP[char]
                sq_idx = rank_idx * 8 + f_idx
                idx = p_idx * 64 + sq_idx
                t[idx] = 1.0
                f_idx += 1
    return t

class ChessDataset(Dataset):
    def __init__(self, jsonl_path):
        self.data = []
        with open(jsonl_path, "r") as f:
            for line in f:
                if not line.strip(): continue
                row = json.loads(line)
                self.data.append(row)

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        row = self.data[idx]
        x = fen_to_tensor(row["fen"])
        y = torch.tensor([float(row["eval_cp"])], dtype=torch.float32)
        return x, y

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, help="Path to config JSON")
    parser.add_argument("--dataset", type=str, help="Path to jsonl dataset (override config)")
    parser.add_argument("--epochs", type=int, help="Training epochs (override config)")
    parser.add_argument("--out", type=str, help="Path to save .nnue binary (override config)")
    args = parser.parse_args()
    
    config = {
        "dataset_train": "data/nnue/processed/train.jsonl",
        "dataset_val": "data/nnue/processed/val.jsonl",
        "epochs": 1,
        "batch_size": 32,
        "lr": 0.001,
        "out_dir": "data/nnue/exports"
    }
    
    if args.config:
        with open(args.config, "r") as f:
            config.update(json.load(f))
            
    if args.dataset: config["dataset_train"] = args.dataset
    if args.epochs: config["epochs"] = args.epochs
    
    out_dir = config["out_dir"]
    os.makedirs(out_dir, exist_ok=True)
    
    out_nnue = args.out if args.out else os.path.join(out_dir, "best_model.nnue")
    out_metrics = os.path.join(out_dir, "metrics.json")
    out_csv = os.path.join(out_dir, "loss_curve.csv")
    
    print(f"Loading training dataset: {config['dataset_train']}")
    train_dataset = ChessDataset(config["dataset_train"])
    train_loader = DataLoader(train_dataset, batch_size=config["batch_size"], shuffle=True)
    
    val_loader = None
    if os.path.exists(config.get("dataset_val", "")):
        print(f"Loading validation dataset: {config['dataset_val']}")
        val_dataset = ChessDataset(config["dataset_val"])
        val_loader = DataLoader(val_dataset, batch_size=config["batch_size"], shuffle=False)

    model = NnueModel()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=config["lr"])
    
    print(f"Training for {config['epochs']} epochs...")
    
    history = []
    best_val_loss = float("inf")
    
    for epoch in range(config["epochs"]):
        model.train()
        total_loss = 0
        for x, y in train_loader:
            optimizer.zero_grad()
            pred = model(x)
            loss = criterion(pred, y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * x.size(0)
            
        train_loss = total_loss / len(train_dataset) if len(train_dataset) > 0 else 0
        
        val_loss = 0
        if val_loader:
            model.eval()
            val_total = 0
            with torch.no_grad():
                for x, y in val_loader:
                    pred = model(x)
                    loss = criterion(pred, y)
                    val_total += loss.item() * x.size(0)
            val_loss = val_total / len(val_dataset) if len(val_dataset) > 0 else 0
            
        print(f"Epoch {epoch+1}/{config['epochs']} - Train Loss: {train_loss:.4f} - Val Loss: {val_loss:.4f}")
        
        history.append({
            "epoch": epoch + 1,
            "train_loss": train_loss,
            "val_loss": val_loss
        })
        
        # Save best model
        current_loss = val_loss if val_loader else train_loss
        if current_loss < best_val_loss:
            best_val_loss = current_loss
            export_to_nnue(model, out_nnue)
            torch.save(model.state_dict(), os.path.join(out_dir, "best_model.pt"))
            
    # Save metrics
    with open(out_metrics, "w") as f:
        json.dump(history, f, indent=2)
        
    with open(out_csv, "w", newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["epoch", "train_loss", "val_loss"])
        writer.writeheader()
        for row in history:
            writer.writerow(row)
            
    print(f"Training complete. Best model exported to {out_nnue}")

if __name__ == "__main__":
    main()
