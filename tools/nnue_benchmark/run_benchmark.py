import json
import argparse
import sys
import os
import time
import subprocess
import requests
import socket

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def start_engine(weights_path=None):
    port = get_free_port()
    env = os.environ.copy()
    env["PORT"] = str(port)
    
    if weights_path:
        env["NNUE_WEIGHTS_PATH"] = weights_path
    elif "NNUE_WEIGHTS_PATH" in env:
        del env["NNUE_WEIGHTS_PATH"]
        
    cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src-rust"))
    exe_path = os.path.join(cwd, "target", "debug", "clash-of-crowns-realtime.exe")
    if not os.path.exists(exe_path):
        exe_path = os.path.join(cwd, "target", "debug", "clash-of-crowns-realtime") # Linux/Mac fallback
        
    proc = subprocess.Popen([exe_path], cwd=cwd, env=env)
    
    # wait for server to start by checking /health
    started = False
    for _ in range(20):
        try:
            r = requests.get(f"http://localhost:{port}/health", timeout=2)
            if r.status_code == 200:
                started = True
                break
        except requests.exceptions.RequestException:
            pass
        time.sleep(1)
        
    if not started:
        print(f"FAILED to start engine on port {port}. exe_path={exe_path}")
        proc.kill()
        sys.exit(1)
        
    return proc, port

def get_engine_move(port, engine_type, fen):
    payload = {
        "fen": fen,
        "engine_type": engine_type,
        "depth": 3,
        "error_noise_cp": 0,
        "max_think_time_ms": 2000
    }
    try:
        r = requests.post(f"http://localhost:{port}/engine/move", json=payload, timeout=5)
        if r.status_code == 200:
            data = r.json()
            return data
    except Exception as e:
        print(f"Error fetching move: {e}")
    return {}

def generate_markdown(results, metadata):
    md = "# NNUE Strength Benchmark Results\n\n"
    
    md += "## Process Lifecycle Verification\n\n"
    for m in metadata:
        md += f"- **Phase**: {m['phase']}\n"
        md += f"  - Port Used: `{m['port']}`\n"
        md += f"  - Process ID: `{m['pid']}`\n"
        md += f"  - Engine Mode Used: `{m['engine_mode']}`\n"
        md += f"  - Weights Status: `{m['weights_status']}`\n"
        md += f"  - Inference Mode: `{m['inference_mode']}`\n"
        md += f"  - Cleanup Succeeded: `{'YES' if m['cleanup_succeeded'] else 'NO'}`\n\n"
        
    md += "## Benchmark Runs\n\n"
    md += "| Test Case | FEN | HCE Move | Placeholder Move | NNUE Move | Status |\n"
    md += "|---|---|---|---|---|---|\n"
    for r in results:
        md += f"| {r['name']} | `{r['fen'][:15]}...` | {r['hce_move']} | {r['placeholder_move']} | {r['nnue_move']} | {r['notes']} |\n"
    return md

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", required=True, help="Path to weights file")
    args = parser.parse_args()
    
    positions_file = os.path.join(os.path.dirname(__file__), "benchmark_positions.json")
    with open(positions_file, "r") as f:
        positions = json.load(f)
        
    results = []
    metadata = []
    
    # Phase 1: Run Placeholder and HCE
    print("Starting Rust engine (Placeholder)...")
    proc_placeholder, port_p = start_engine(weights_path=None)
    
    meta_p = {
        "phase": "Placeholder / HCE",
        "port": port_p,
        "pid": proc_placeholder.pid,
        "engine_mode": "unknown",
        "weights_status": "unknown",
        "inference_mode": "unknown",
        "cleanup_succeeded": False
    }
    
    try:
        for pos in positions:
            fen = pos["fen"]
            name = pos["name"]
            
            print(f"Placeholder: Processing {name}")
            
            # HCE
            hce_data = get_engine_move(port_p, "hce", fen)
            hce_move = hce_data.get("move_str", "error")
            
            # Extract HCE metadata from the first response
            if meta_p["engine_mode"] == "unknown" and hce_data:
                meta_p["engine_mode"] = f"hce_test={hce_data.get('engine_used', 'unknown')}"
                
            # Placeholder
            placeholder_data = get_engine_move(port_p, "nnue", fen)
            placeholder_move = placeholder_data.get("move_str", "error")
            
            # Extract Placeholder metadata
            if meta_p["weights_status"] == "unknown" and placeholder_data:
                meta_p["weights_status"] = placeholder_data.get("weights_status", "unknown")
                meta_p["inference_mode"] = placeholder_data.get("inference_mode", "unknown")
                meta_p["engine_mode"] += f" | nnue_test={placeholder_data.get('engine_used', 'unknown')}"
            
            results.append({
                "name": name,
                "fen": fen,
                "hce_move": hce_move,
                "placeholder_move": placeholder_move,
                "expected": pos.get("expected_move")
            })
    finally:
        print(f"Terminating placeholder engine (PID {proc_placeholder.pid})...")
        proc_placeholder.kill()
        proc_placeholder.wait()
        meta_p["cleanup_succeeded"] = True
        metadata.append(meta_p)
        
    # Phase 2: Run Trained NNUE
    print(f"Starting Rust engine (Tensor NNUE) with {args.weights}...")
    abs_weights = os.path.abspath(args.weights)
    proc_nnue, port_n = start_engine(weights_path=abs_weights)
    
    meta_n = {
        "phase": "Trained NNUE",
        "port": port_n,
        "pid": proc_nnue.pid,
        "engine_mode": "unknown",
        "weights_status": "unknown",
        "inference_mode": "unknown",
        "cleanup_succeeded": False
    }
    
    try:
        for r in results:
            print(f"NNUE: Processing {r['name']}")
            nnue_data = get_engine_move(port_n, "nnue", r["fen"])
            nnue_move = nnue_data.get("move_str", "error")
            r["nnue_move"] = nnue_move
            
            # Extract NNUE metadata
            if meta_n["weights_status"] == "unknown" and nnue_data:
                meta_n["engine_mode"] = nnue_data.get("engine_used", "unknown")
                meta_n["weights_status"] = nnue_data.get("weights_status", "unknown")
                meta_n["inference_mode"] = nnue_data.get("inference_mode", "unknown")
            
            # Evaluate performance
            match_improve = "NO"
            notes = "Fails tactic"
            if r["expected"]:
                if nnue_move == r["expected"]:
                    notes = "Found expected move"
                else:
                    notes = f"Missed expected {r['expected']}"
            else:
                if nnue_move == r["placeholder_move"]:
                    notes = "Matches placeholder"
                elif nnue_move == r["hce_move"]:
                    notes = "Matches HCE"
                else:
                    notes = "Diverged, likely weak"
                    
            r["notes"] = notes
    finally:
        print(f"Terminating NNUE engine (PID {proc_nnue.pid})...")
        proc_nnue.kill()
        proc_nnue.wait()
        meta_n["cleanup_succeeded"] = True
        metadata.append(meta_n)

    md = generate_markdown(results, metadata)
    
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "docs", "testing"))
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "NNUE_STRENGTH_BENCHMARK_RESULTS.md")
    
    with open(out_file, "w") as f:
        f.write(md)
        
    print(f"Benchmark complete. Results saved to {out_file}")

if __name__ == "__main__":
    main()
