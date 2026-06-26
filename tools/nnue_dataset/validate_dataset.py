import sys
import json
import re

def validate_fen(fen):
    parts = fen.split()
    return len(parts) == 6

def validate_move(move):
    return bool(re.match(r'^[a-h][1-8][a-h][1-8][qrbn]?$', move))

def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_dataset.py <dataset.jsonl>")
        sys.exit(1)
        
    dataset_path = sys.argv[1]
    
    total = 0
    valid = 0
    invalid = 0
    phases = {"opening": 0, "middlegame": 0, "endgame": 0}
    seen_fens = set()
    duplicates = 0
    
    with open(dataset_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
                
            total += 1
            try:
                row = json.loads(line)
                
                # Validation rules
                if not validate_fen(row['fen']):
                    raise ValueError("Invalid FEN")
                
                if not isinstance(row['eval_cp'], int):
                    raise ValueError("eval_cp must be integer")
                    
                if not validate_move(row['best_move']):
                    raise ValueError("Invalid best_move UCI")
                
                phase = row['game_phase']
                if phase not in phases:
                    raise ValueError("Invalid game_phase")
                    
                # Duplicates check
                if row['fen'] in seen_fens:
                    duplicates += 1
                else:
                    seen_fens.add(row['fen'])
                    
                phases[phase] += 1
                valid += 1
                
            except Exception as e:
                print(f"Row {total} invalid: {e} -> {line}")
                invalid += 1

    print(f"\n--- Dataset Validation Summary ---")
    print(f"Total Rows:     {total}")
    print(f"Valid Rows:     {valid}")
    print(f"Invalid Rows:   {invalid}")
    print(f"Duplicates:     {duplicates}")
    print(f"Opening:        {phases['opening']}")
    print(f"Middlegame:     {phases['middlegame']}")
    print(f"Endgame:        {phases['endgame']}")
    print(f"----------------------------------\n")

    if invalid > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
