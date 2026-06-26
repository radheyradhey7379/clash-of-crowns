import json
import chess
import sys

def main(filepath):
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        sys.exit(1)

    errors = 0
    validated = 0

    for idx, item in enumerate(data):
        fen = item.get("fen")
        expected_move = item.get("expected_move")
        tag = item.get("tag")
        name = item.get("name", f"Position {idx}")

        try:
            board = chess.Board(fen)
        except ValueError as e:
            print(f"ERROR [{name}]: Invalid FEN '{fen}' - {e}")
            errors += 1
            continue

        if expected_move:
            try:
                move = chess.Move.from_uci(expected_move)
                if move not in board.legal_moves:
                    print(f"ERROR [{name}]: Expected move '{expected_move}' is illegal.")
                    errors += 1
                    continue

                if tag == "mate_in_1":
                    board.push(move)
                    if not board.is_checkmate():
                        print(f"ERROR [{name}]: Tagged 'mate_in_1' but move '{expected_move}' does not result in checkmate.")
                        errors += 1
                    board.pop()

            except Exception as e:
                print(f"ERROR [{name}]: Invalid UCI expected move '{expected_move}' - {e}")
                errors += 1
                continue

        validated += 1

    if errors > 0:
        print(f"\nValidation failed with {errors} errors.")
        sys.exit(1)
    else:
        print(f"\nSuccessfully validated {validated} positions.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_benchmark_positions.py <benchmark_positions.json>")
        sys.exit(1)
    main(sys.argv[1])
