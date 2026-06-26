import json
import os

def generate_tactics():
    # Load from the validated benchmark positions
    benchmark_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "nnue_benchmark", "benchmark_positions.json"))
    
    with open(benchmark_path, "r") as f:
        tactics = json.load(f)
        
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "nnue", "raw"))
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "tactics.jsonl")
    
    with open(out_file, "w") as f:
        for t in tactics:
            row = {
                "fen": t["fen"],
                "eval_cp": 0, # Will be labeled
                "best_move": t["expected_move"],
                "game_phase": "middlegame",
                "source": "synthetic_tactics",
                "depth": 0,
                "tag": t["tag"]
            }
            f.write(json.dumps(row) + "\n")
            
    print(f"Generated {len(tactics)} synthetic tactical positions to {out_file}")

if __name__ == "__main__":
    generate_tactics()
