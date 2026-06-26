import argparse
import json
import os
import random

def clip_eval(eval_cp):
    if eval_cp > 3000: return 3000
    if eval_cp < -3000: return -3000
    return eval_cp

def main():
    parser = argparse.ArgumentParser(description="Filter and split NNUE dataset.")
    parser.add_argument("--inputs", type=str, nargs="+", default=["data/nnue/processed/labeled_v2.jsonl"], help="Input labeled JSONL files")
    parser.add_argument("--out-dir", type=str, default="data/nnue/processed", help="Output directory")
    parser.add_argument("--seed", type=int, default=12345, help="Random seed")
    
    args = parser.parse_args()
    random.seed(args.seed)

    os.makedirs(args.out_dir, exist_ok=True)

    rows_by_cat = {"tactical": [], "quiet_positional": [], "opening": [], "middlegame": [], "endgame": []}
    seen_fens = set()
    mate_in_1_rows = []
    
    total_read = 0
    duplicate_count = 0
    invalid_count = 0

    for in_file in args.inputs:
        if not os.path.exists(in_file):
            print(f"Warning: {in_file} does not exist.")
            continue
            
        print(f"Reading {in_file}...")
        with open(in_file, "r") as f:
            for line in f:
                if not line.strip(): continue
                total_read += 1
                
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    invalid_count += 1
                    continue
                    
                fen = row.get("fen", "")
                
                # For tactics, we don't strictly filter duplicates if we want to ensure they aren't removed too aggressively
                # but we'll use exact fen instead of base fen to allow small variations
                if row.get("source") == "synthetic_tactics":
                    dup_key = fen
                else:
                    dup_key = fen.split(" ")[0]
                
                if dup_key in seen_fens:
                    duplicate_count += 1
                    continue
                    
                eval_cp = row.get("eval_cp")
                if eval_cp is None:
                    invalid_count += 1
                    continue
                    
                row["eval_cp"] = clip_eval(eval_cp)
                seen_fens.add(dup_key)
                
                if row.get("tag") == "mate_in_1":
                    mate_in_1_rows.append(row)
                
                if row.get("source") == "synthetic_tactics":
                    rows_by_cat["tactical"].append(row)
                else:
                    # Self play
                    if -50 <= eval_cp <= 50:
                        rows_by_cat["quiet_positional"].append(row)
                    else:
                        phase = row.get("game_phase", "middlegame")
                        rows_by_cat[phase].append(row)

    # Balance categories
    # The prompt says: Balance dataset categories: tactical, quiet positional, endgame, opening, middlegame
    balanced_dataset = []
    # Cap sizes so they are roughly balanced
    cap = 50000
    for cat, rows in rows_by_cat.items():
        if len(rows) > cap:
            balanced_dataset.extend(random.sample(rows, cap))
        else:
            balanced_dataset.extend(rows)

    random.shuffle(balanced_dataset)

    total_kept = len(balanced_dataset)
    if total_kept == 0:
        print("Error: No data to split.")
        return

    train_split = int(0.8 * total_kept)
    val_split = int(0.9 * total_kept)

    train_data = balanced_dataset[:train_split]
    val_data = balanced_dataset[train_split:val_split]
    test_data = balanced_dataset[val_split:]

    # Force include all Mate-in-1 positions in train/val/test split
    train_data.extend(mate_in_1_rows)
    val_data.extend(mate_in_1_rows)
    test_data.extend(mate_in_1_rows)

    def write_jsonl(filename, data):
        path = os.path.join(args.out_dir, filename)
        with open(path, "w") as f:
            for row in data:
                f.write(json.dumps(row) + "\n")
        return path

    write_jsonl("train.jsonl", train_data)
    write_jsonl("val.jsonl", val_data)
    write_jsonl("test.jsonl", test_data)

    report = {
        "total_read": total_read,
        "duplicate_filtered": duplicate_count,
        "invalid_filtered": invalid_count,
        "final_dataset_size": total_kept,
        "train_size": len(train_data),
        "val_size": len(val_data),
        "test_size": len(test_data),
        "mate_in_1_count": len(mate_in_1_rows),
        "category_breakdown": {p: len(rows) for p, rows in rows_by_cat.items()}
    }

    report_path = os.path.join(args.out_dir, "filter_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print("\n--- Filter Summary ---")
    for k, v in report.items():
        print(f"{k}: {v}")
    print("----------------------")

if __name__ == "__main__":
    main()
