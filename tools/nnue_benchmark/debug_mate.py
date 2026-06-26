import chess

fen = "1k6/8/1K6/8/8/8/2Q5/8 w - - 0 1"
board = chess.Board(fen)
print("Legal moves:")
for m in board.legal_moves:
    board.push(m)
    if board.is_checkmate():
        print(f"MATE: {m.uci()}")
    board.pop()
