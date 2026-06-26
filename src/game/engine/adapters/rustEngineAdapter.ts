import { IEngineAdapter, EngineRequest, EngineResult } from '../types';

function parseUciMove(uci: string): { from: string; to: string; promotion?: string } | null {
  if (!uci || uci.length < 4) return null;
  const from = uci.substring(0, 2);
  const to = uci.substring(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;
  return { from, to, promotion };
}

export class RustEngineAdapter implements IEngineAdapter {
  private abortController: AbortController | null = null;
  private engineType: "hce" | "nnue";

  constructor(engineType: "hce" | "nnue") {
    this.engineType = engineType;
  }
  
  async computeMove(request: EngineRequest): Promise<EngineResult> {
    this.abortController = new AbortController();
    
    // We use the URL from env, default to local if not set
    const RUST_URL = import.meta.env.VITE_RUST_ENGINE_URL || 'http://localhost:3001';

    try {
      const response = await fetch(`${RUST_URL}/engine/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.abortController.signal,
        body: JSON.stringify({
          fen: request.fen,
          engine_type: this.engineType,
          depth: request.depth,
          error_noise_cp: request.errorNoiseCp,
          max_think_time_ms: request.maxThinkTimeMs,
          bot_profile_id: request.botProfileId,
          style: request.style,
          recent_moves: request.recentMoves,
          recent_fens: request.recentFens,
        }),
      });

      if (!response.ok) {
        throw new Error(`Rust NNUE engine error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (import.meta.env.DEV) {
        console.log(`[Rust Engine DEV Log]`, {
          selected_bot: request.botProfileId || 'Unknown',
          engine_type: this.engineType,
          depth: request.depth,
          error_noise_cp: request.errorNoiseCp,
          weights_status: data.weights_status || 'unknown',
          think_time_ms: data.think_time_ms || 0,
        });
      }
      
      return {
        move: parseUciMove(data.move_str),
        engineUsed: data.engine_used || this.engineType,
        thinkTimeMs: data.think_time_ms || 0,
        searchDepth: data.depth || request.depth,
        evalCp: data.eval_cp || 0,
        noiseApplied: data.noise_applied || 0,
        wasFallback: false,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      console.warn(`Rust ${this.engineType} adapter failed, propagating.`, err);
      throw err;
    }
  }
  
  cancel() {
    this.abortController?.abort();
  }
  
  dispose() {
    this.cancel();
  }

  isReady(): boolean {
    return true; // Assume ready, HTTP calls will fail gracefully if not
  }
}
