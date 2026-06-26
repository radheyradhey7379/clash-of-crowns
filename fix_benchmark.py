import json
import os
import chess

tactics = [
    # Mate in 1 (10 positions)
    {"name": "Fools Mate", "fen": "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 1", "expected_move": "d8h4", "tag": "mate_in_1"},
    {"name": "Scholars Mate", "fen": "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1", "expected_move": "f3f7", "tag": "mate_in_1"},
    {"name": "Back Rank", "fen": "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1", "expected_move": "e1e8", "tag": "mate_in_1"},
    {"name": "Smothered", "fen": "6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1", "expected_move": "e5f7", "tag": "mate_in_1"},
    {"name": "Arabian 2", "fen": "7k/R7/5N2/8/8/8/8/5K2 w - - 0 1", "expected_move": "a7h7", "tag": "mate_in_1"},
    {"name": "Queen + King", "fen": "8/8/8/8/8/1K6/2Q5/k7 w - - 0 1", "expected_move": "c2b2", "tag": "mate_in_1"},
    {"name": "Two Rooks", "fen": "6k1/5ppp/8/8/8/8/R7/K1R5 w - - 0 1", "expected_move": "c1c8", "tag": "mate_in_1"},
    {"name": "Anastasia-like", "fen": "6k1/R7/8/8/8/8/8/K1R5 w - - 0 1", "expected_move": "c1c8", "tag": "mate_in_1"},
    {"name": "Boden", "fen": "2kr3r/pp2nppp/2n5/1B6/8/5b2/PP3PPP/R1B1K1NR b KQ - 0 1", "expected_move": "d8d1", "tag": "mate_in_1"},
    {"name": "Arabian", "fen": "7k/R7/5N2/8/8/8/8/K7 w - - 0 1", "expected_move": "a7h7", "tag": "mate_in_1"},

    # Hanging Queen (5 positions)
    {"name": "Hanging Queen 1", "fen": "8/8/8/3q4/8/3Q4/8/K1k5 w - - 0 1", "expected_move": "d3d5", "tag": "hanging_queen"},
    {"name": "Hanging Queen 2", "fen": "8/8/8/8/4Q3/8/4q3/K1k5 b - - 0 1", "expected_move": "e2e4", "tag": "hanging_queen"},
    {"name": "Hanging Queen 3", "fen": "r1bqkbnr/pppppppp/8/8/3n4/8/PPPPQPPP/RNB1KBNR b KQkq - 0 1", "expected_move": "d4e2", "tag": "hanging_queen"},
    {"name": "Hanging Queen 4", "fen": "rnb1kbnr/pppppppp/2q5/8/3N4/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1", "expected_move": "d4c6", "tag": "hanging_queen"},
    {"name": "Hanging Queen 5", "fen": "8/8/8/8/4q3/4R3/8/K1k5 w - - 0 1", "expected_move": "e3e4", "tag": "hanging_queen"},

    # Hanging Rook (5 positions)
    {"name": "Hanging Rook 1", "fen": "8/8/8/8/3R4/8/3r4/K1k5 w - - 0 1", "expected_move": "d4d2", "tag": "hanging_rook"},
    {"name": "Hanging Rook 2", "fen": "8/8/8/8/4r3/8/4R3/K1k5 b - - 0 1", "expected_move": "e4e2", "tag": "hanging_rook"},
    {"name": "Hanging Rook 3", "fen": "4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1", "expected_move": "e2e7", "tag": "hanging_rook"},
    {"name": "Hanging Rook 4", "fen": "rnbqkbnr/1pppppp1/8/8/8/8/1PPPPPP1/RNBQKBNR b KQkq - 0 1", "expected_move": "a8a1", "tag": "hanging_rook"},
    {"name": "Hanging Rook 5", "fen": "k7/8/8/8/8/3R4/3r4/4K3 w - - 0 1", "expected_move": "d3d2", "tag": "hanging_rook"},

    # Fork (10 positions)
    {"name": "Knight Fork 1", "fen": "8/2k1q3/8/8/8/4N3/8/7K w - - 0 1", "expected_move": "e3d5", "tag": "fork"},
    {"name": "Knight Fork 2", "fen": "8/8/4n3/8/8/8/2K1Q3/7k b - - 0 1", "expected_move": "e6d4", "tag": "fork"},
    {"name": "Knight Fork 3", "fen": "8/8/2k1r3/8/8/4N3/8/7K w - - 0 1", "expected_move": "e3d5", "tag": "fork"},
    {"name": "Knight Fork 4", "fen": "8/8/4n3/8/8/2K1R3/8/7k b - - 0 1", "expected_move": "e6d4", "tag": "fork"},
    {"name": "Knight Fork 5", "fen": "r1bqkbnr/pppp1ppp/2n5/4N3/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1", "expected_move": "e5c6", "tag": "fork"},
    {"name": "Fork 6", "fen": "8/2k1q3/8/8/8/3N4/8/7K w - - 0 1", "expected_move": "d3f4", "tag": "fork"},
    {"name": "Fork 7", "fen": "8/8/3n4/8/8/2K1Q3/8/7k b - - 0 1", "expected_move": "d6f5", "tag": "fork"},
    {"name": "Fork 8", "fen": "8/2r1k3/8/8/8/3N4/8/7K w - - 0 1", "expected_move": "d3b4", "tag": "fork"},
    {"name": "Fork 9", "fen": "8/8/3n4/8/8/2R1K3/8/7k b - - 0 1", "expected_move": "d6b5", "tag": "fork"},
    {"name": "Fork 10", "fen": "8/4k3/8/2q5/8/3B4/8/7K w - - 0 1", "expected_move": "d3f5", "tag": "fork"},

    # Promotion (10 positions)
    {"name": "Promotion 1", "fen": "8/3P4/8/8/8/8/K1k5/8 w - - 0 1", "expected_move": "d7d8q", "tag": "promotion"},
    {"name": "Promotion 2", "fen": "8/4P3/8/8/8/8/K1k5/8 w - - 0 1", "expected_move": "e7e8q", "tag": "promotion"},
    {"name": "Promotion 3", "fen": "8/5P2/8/8/8/8/K1k5/8 w - - 0 1", "expected_move": "f7f8q", "tag": "promotion"},
    {"name": "Promotion 4", "fen": "8/6P1/8/8/8/8/K1k5/8 w - - 0 1", "expected_move": "g7g8q", "tag": "promotion"},
    {"name": "Promotion 5", "fen": "8/7P/8/8/8/8/K1k5/8 w - - 0 1", "expected_move": "h7h8q", "tag": "promotion"},
    {"name": "Promotion 6", "fen": "8/K1k5/8/8/8/8/3p4/8 b - - 0 1", "expected_move": "d2d1q", "tag": "promotion"},
    {"name": "Promotion 7", "fen": "8/K1k5/8/8/8/8/4p3/8 b - - 0 1", "expected_move": "e2e1q", "tag": "promotion"},
    {"name": "Promotion 8", "fen": "8/K1k5/8/8/8/8/5p2/8 b - - 0 1", "expected_move": "f2f1q", "tag": "promotion"},
    {"name": "Promotion 9", "fen": "8/K1k5/8/8/8/8/6p1/8 b - - 0 1", "expected_move": "g2g1q", "tag": "promotion"},
    {"name": "Promotion 10", "fen": "8/K1k5/8/8/8/8/7p/8 b - - 0 1", "expected_move": "h2h1q", "tag": "promotion"},

    # Defensive (10 positions)
    {"name": "Defensive 1", "fen": "rnbqkbnr/pppp1ppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "expected_move": "d2d4", "tag": "defensive"},
    {"name": "Defensive 2", "fen": "r1bqkbnr/pppp1ppp/2n5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "expected_move": "d2d4", "tag": "defensive"},
    {"name": "Defensive 3", "fen": "r1bqkbnr/pp1p1ppp/2n5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "expected_move": "d2d4", "tag": "defensive"},
    {"name": "Defensive 4", "fen": "r1bqkbnr/pp1p1ppp/2n5/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "expected_move": "d2d4", "tag": "defensive"},
    {"name": "Defensive 5", "fen": "r1bqkbnr/pp1p1ppp/2n5/4p3/3P4/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1", "expected_move": "d4e5", "tag": "defensive"},
    {"name": "Defensive 6", "fen": "r1bqkbnr/pp1p1ppp/2n5/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "expected_move": "c6e5", "tag": "defensive"},
    {"name": "Defensive 7", "fen": "r1bqkbnr/pp1p1ppp/8/4n3/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1", "expected_move": "d2d4", "tag": "defensive"},
    {"name": "Defensive 8", "fen": "r1bqkbnr/pp1p1ppp/8/4n3/8/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 1", "expected_move": "e5f3", "tag": "defensive"},
    {"name": "Defensive 9", "fen": "r1bqkbnr/pp1p1ppp/8/8/8/5n2/PPPP1PPP/RNBQKB1R w KQkq - 0 1", "expected_move": "g2f3", "tag": "defensive"},
    {"name": "Defensive 10", "fen": "r1bqkbnr/pp1p1ppp/8/8/8/5P2/PPPP1P1P/RNBQKB1R b KQkq - 0 1", "expected_move": "g8f6", "tag": "defensive"}
]

# Quick validation using python-chess
valid_count = 0
for t in tactics:
    try:
        board = chess.Board(t["fen"])
        if board.is_valid():
            valid_count += 1
            # Check if expected move is pseudo-legal
            m = chess.Move.from_uci(t["expected_move"])
            if m not in board.legal_moves:
                print(f"ILLEGAL MOVE in {t['name']}: {t['expected_move']}")
        else:
            print(f"INVALID BOARD in {t['name']}: {t['fen']} - {board.status()}")
    except Exception as e:
        print(f"EXCEPTION in {t['name']}: {e}")

print(f"Validated {valid_count}/{len(tactics)}")

out_path = os.path.join(os.path.dirname(__file__), "tools", "nnue_benchmark", "benchmark_positions.json")
with open(out_path, "w") as f:
    json.dump(tactics, f, indent=4)
print(f"Wrote to {out_path}")
