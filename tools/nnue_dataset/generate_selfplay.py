import argparse
import random
import requests
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import chess
except ImportError:
    print("python-chess not found. Please install it using `pip install chess`.")
    sys.exit(1)

PROFILES = {
    "beginner": {"engine_type": "hce", "depth": 1, "error_noise_cp": 150},
    "learner": {"engine_type": "hce", "depth": 1, "error_noise_cp": 80},
    "intermediate": {"engine_type": "nnue", "depth": 2, "error_noise_cp": 40},
    "hard": {"engine_type": "nnue", "depth": 2, "error_noise_cp": 20},
    "master": {"engine_type": "nnue", "depth": 3, "error_noise_cp": 10},
    "grandmaster": {"engine_type": "nnue", "depth": 3, "error_noise_cp": 0},
}

def determine_phase(board):
    pieces = sum(1 for _ in board.piece_map())
    if pieces > 28:
        return "opening"
    elif pieces > 12:
        return "middlegame"
    else:
        return "endgame"

def get_engine_move(url, fen, profile, session, max_time_ms=50):
    payload = {
        "fen": fen,
        "engine_type": profile["engine_type"],
        "depth": profile["depth"],
        "error_noise_cp": profile["error_noise_cp"],
        "max_think_time_ms": max_time_ms
    }
    
    try:
        resp = session.post(f"{url}/engine/move", json=payload, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        return data, None
    except requests.exceptions.RequestException as e:
        return None, str(e)

def play_game(game_idx, args, matchups):
    random.seed(args.seed + game_idx)
    board = chess.Board()
    
    if args.mix_profiles:
        profile_w, profile_b = random.choice(matchups)
        if random.random() < 0.2:
            profile_w = random.choice(list(PROFILES.keys()))
            profile_b = random.choice(list(PROFILES.keys()))
    else:
        profile_w, profile_b = "grandmaster", "grandmaster"
        
    moves_played = 0
    terminal_reason = "max_moves"
    game_rows = []
    
    with requests.Session() as session:
        while moves_played < args.max_moves:
            if board.is_checkmate():
                terminal_reason = "checkmate"
                break
            if board.is_stalemate() or board.is_insufficient_material() or board.is_repetition():
                terminal_reason = "draw"
                break

            current_profile = PROFILES[profile_w] if board.turn == chess.WHITE else PROFILES[profile_b]
            fen = board.fen()
            
            data, err = get_engine_move(args.engine_url, fen, current_profile, session)
            if err or not data:
                terminal_reason = "engine_error"
                break
                
            move_str = data.get("move_str", "")
            if not move_str:
                terminal_reason = "no_move_returned"
                break
                
            try:
                move = chess.Move.from_uci(move_str)
                if move not in board.legal_moves:
                    terminal_reason = "illegal_move"
                    break
            except Exception:
                terminal_reason = "invalid_uci"
                break
                
            phase = determine_phase(board)
            eval_cp = data.get("eval_cp", 0)
            
            row = {
                "fen": fen,
                "eval_cp": eval_cp,
                "best_move": move_str,
                "game_phase": phase,
                "source": "selfplay",
                "depth": current_profile["depth"]
            }
            game_rows.append(row)

            board.push(move)
            moves_played += 1

    return game_idx, terminal_reason, moves_played, game_rows

def main():
    parser = argparse.ArgumentParser(description="Generate self-play datasets concurrently.")
    parser.add_argument("--games", type=int, default=10, help="Number of games to simulate")
    parser.add_argument("--max-moves", type=int, default=120, help="Max moves per game")
    parser.add_argument("--out", type=str, default="data/nnue/raw/selfplay.jsonl", help="Output JSONL file")
    parser.add_argument("--engine-url", type=str, default="http://localhost:3001", help="URL of the Rust engine")
    parser.add_argument("--mix-profiles", type=bool, default=True, help="Mix different profiles")
    parser.add_argument("--seed", type=int, default=12345, help="Random seed")
    parser.add_argument("--workers", type=int, default=20, help="Concurrent games")
    parser.add_argument("--dry-run", action="store_true", help="Run without writing to file")

    args = parser.parse_args()
    
    matchups = [
        ("beginner", "beginner"),
        ("learner", "learner"),
        ("intermediate", "hard"),
        ("master", "grandmaster"),
    ]

    print(f"Starting concurrent self-play for {args.games} games with {args.workers} workers...")
    
    if not args.dry_run:
        out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", os.path.dirname(args.out)))
        os.makedirs(out_dir, exist_ok=True)
        out_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", args.out))
        out_file = open(out_file_path, "w")
    
    total_positions = 0
    seen_fens = set()
    completed_games = 0

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(play_game, i, args, matchups) for i in range(args.games)]
        
        for future in as_completed(futures):
            game_idx, terminal_reason, moves_played, game_rows = future.result()
            completed_games += 1
            
            for row in game_rows:
                base_fen = row["fen"].split(" ")[0]
                if base_fen not in seen_fens:
                    seen_fens.add(base_fen)
                    total_positions += 1
                    if not args.dry_run:
                        out_file.write(json.dumps(row) + "\n")
                        out_file.flush()
                        
            print(f"Game {completed_games}/{args.games} finished ({terminal_reason}) after {moves_played} moves. Total Unique Pos: {total_positions}")

    if not args.dry_run:
        out_file.close()

    print("\n--- Self-Play Summary ---")
    print(f"Total Games: {completed_games}")
    print(f"Unique Positions: {total_positions}")
    print("-------------------------")

if __name__ == "__main__":
    main()
