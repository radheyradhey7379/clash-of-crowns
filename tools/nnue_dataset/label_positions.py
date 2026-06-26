import argparse
import json
import os
import sys
import chess
import chess.engine
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_label(fen, args, engine_path):
    try:
        with chess.engine.SimpleEngine.popen_uci(engine_path) as engine:
            board = chess.Board(fen)
            limit = chess.engine.Limit(depth=args.label_depth if args.label_depth else 12, time=2.0)
            result = engine.analyse(board, limit)
            
            best_move = result.get("pv", [None])[0]
            if best_move is None:
                return None, "No move found"
                
            score = result["score"].white()
            if score.is_mate():
                eval_cp = 20000 if score.mate() > 0 else -20000
            else:
                eval_cp = score.score()
                
            return {
                "move_str": best_move.uci(),
                "eval_cp": eval_cp,
                "depth": result["depth"]
            }, None
    except Exception as e:
        return None, str(e)

def process_row(row, args, engine_path):
    fen = row.get("fen")
    if not fen:
        return None
        
    data, err = get_label(fen, args, engine_path)
    if data:
        # Only overwrite best_move if it's not a synthetic tactic, 
        # or if we explicitly want to relabel everything.
        # But wait, synthetic tactics have "best_move" from benchmark.
        # We should NOT overwrite "best_move" if it's a generated tactic,
        # but we WANT the stockfish eval.
        if row.get("source") != "synthetic_tactics":
            row["best_move"] = data["move_str"]
            
        row["eval_cp"] = data["eval_cp"]
        row["depth"] = data["depth"]
        row["source"] = row.get("source", "labeled")
        return row
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=str, required=True, help="Input JSONL file")
    parser.add_argument("--out", type=str, required=True, help="Output JSONL file")
    parser.add_argument("--label-depth", type=int, default=12, help="Search depth (e.g. 12)")
    parser.add_argument("--workers", type=int, default=4, help="Number of concurrent workers")
    args = parser.parse_args()
    
    in_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", args.input))
    out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", args.out))
    engine_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "stockfish_engine", "stockfish", "stockfish-windows-x86-64-avx2.exe"))
    
    if not os.path.exists(engine_path):
        print(f"Error: Stockfish not found at {engine_path}")
        sys.exit(1)
        
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    print(f"Reading {args.input}...")
    
    with open(in_path, "r") as f:
        lines = f.readlines()
        
    labeled_count = 0
    
    with open(out_path, "w") as out_f:
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = []
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                    futures.append(executor.submit(process_row, row, args, engine_path))
                except Exception as e:
                    pass
            
            for future in as_completed(futures):
                result = future.result()
                if result:
                    out_f.write(json.dumps(result) + "\n")
                    labeled_count += 1
                    if labeled_count % 10 == 0:
                        print(f"Labeled {labeled_count} positions...")
                    out_f.flush()
                        
    print(f"Done. Wrote {labeled_count} labeled positions to {args.out}")

if __name__ == "__main__":
    main()
