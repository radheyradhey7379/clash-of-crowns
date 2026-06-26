import os
import sys
import json
import time
import subprocess
import requests

try:
    import torch
    import torch.nn as nn
except ImportError:
    print("PyTorch not installed.")
    sys.exit(1)

from model import NnueModel
from export_weights import export_to_nnue

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

def create_deterministic_model():
    torch.manual_seed(42)
    model = NnueModel()
    
    # Initialize weights to small deterministic values to avoid overflow
    # and to ensure test predictability.
    nn.init.uniform_(model.fc1.weight, -0.05, 0.05)
    nn.init.uniform_(model.fc1.bias, -0.05, 0.05)
    nn.init.uniform_(model.fc2.weight, -0.05, 0.05)
    nn.init.uniform_(model.fc2.bias, -0.05, 0.05)
    nn.init.uniform_(model.fc3.weight, -0.05, 0.05)
    nn.init.uniform_(model.fc3.bias, -0.05, 0.05)
    
    model.eval()
    return model

def start_engine(weights_path):
    env = os.environ.copy()
    env["NNUE_WEIGHTS_PATH"] = weights_path
        
    cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src-rust"))
    
    exe_path = os.path.join(cwd, "target", "debug", "clash-of-crowns-realtime.exe")
    if not os.path.exists(exe_path):
        exe_path = os.path.join(cwd, "target", "debug", "clash-of-crowns-realtime") # Linux/Mac fallback
        
    proc = subprocess.Popen([exe_path], cwd=cwd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # wait for server to start
    started = False
    for _ in range(20):
        try:
            r = requests.get("http://localhost:3001/health", timeout=2)
            if r.status_code == 200:
                started = True
                break
        except requests.exceptions.RequestException:
            pass
        time.sleep(1)
        
    if not started:
        print(f"FAILED to start engine. exe_path={exe_path}")
        proc.kill()
        sys.exit(1)
        
    return proc

def test_fen_consistency(model, fen):
    # 1. Python eval
    x = fen_to_tensor(fen)
    with torch.no_grad():
        py_eval = model(x).item()
        
    # 2. Rust eval
    payload = {
        "fen": fen,
        "engine_type": "nnue"
    }
    r = requests.post("http://localhost:3001/engine/eval", json=payload, timeout=5)
    if r.status_code != 200:
        raise Exception(f"Rust server returned error: {r.status_code}")
        
    data = r.json()
    rs_eval = data["eval_cp"]
    mode = data["inference_mode"]
    
    if mode != "tensor":
        raise Exception(f"Rust engine did not use tensor inference. Mode: {mode}")
        
    diff = abs(py_eval - rs_eval)
    return py_eval, rs_eval, diff

def main():
    print("Creating deterministic PyTorch model...")
    model = create_deterministic_model()
    
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "nnue", "exports"))
    os.makedirs(out_dir, exist_ok=True)
    weights_path = os.path.join(out_dir, "consistency_test.nnue")
    
    print(f"Exporting weights to {weights_path}...")
    export_to_nnue(model, weights_path)
    
    print("Building Rust engine (cargo build)...")
    cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src-rust"))
    subprocess.run(["cargo", "build"], cwd=cwd, check=True)
    
    print("Starting Rust engine...")
    proc = start_engine(weights_path)
    
    fens = [
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5",
        "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
        "3r4/8/8/8/8/8/8/3R4 w - - 0 1"
    ]
    
    results = []
    all_passed = True
    
    try:
        for fen in fens:
            py_eval, rs_eval, diff = test_fen_consistency(model, fen)
            passed = diff <= 2.0  # Allow integer rounding difference
            print(f"FEN: {fen}")
            print(f"  PyTorch : {py_eval:.4f}")
            print(f"  Rust    : {rs_eval}")
            print(f"  Diff    : {diff:.4f}  -> {'PASS' if passed else 'FAIL'}")
            
            results.append({
                "fen": fen,
                "pytorch_eval": py_eval,
                "rust_eval": rs_eval,
                "diff": diff,
                "passed": passed
            })
            if not passed:
                all_passed = False
    finally:
        print("Terminating Rust engine...")
        proc.kill()
        proc.wait()
        
    md = "# Python / Rust NNUE Consistency Test\n\n"
    md += f"**Overall Status**: {'PASS' if all_passed else 'FAIL'}\n\n"
    md += "| FEN | PyTorch Eval | Rust Eval (centipawns) | Absolute Diff | Status |\n"
    md += "|---|---|---|---|---|\n"
    
    for r in results:
        status = "PASS" if r["passed"] else "FAIL"
        md += f"| `{r['fen']}` | {r['pytorch_eval']:.4f} | {r['rust_eval']} | {r['diff']:.4f} | {status} |\n"
        
    docs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "docs", "testing"))
    os.makedirs(docs_dir, exist_ok=True)
    report_path = os.path.join(docs_dir, "NNUE_RUST_PYTHON_CONSISTENCY.md")
    with open(report_path, "w") as f:
        f.write(md)
        
    print(f"\nReport written to {report_path}")
    
    if not all_passed:
        sys.exit(1)
    
if __name__ == "__main__":
    main()
