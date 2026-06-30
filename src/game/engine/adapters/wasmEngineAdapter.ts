import { IEngineAdapter, EngineRequest, EngineResult } from '../types';
import WasmWorker from '../workers/rustWasmEngine.worker?worker';

function parseUciMove(uci: string): { from: string; to: string; promotion?: string } | null {
  if (!uci || uci.length < 4) return null;
  const from = uci.substring(0, 2);
  const to = uci.substring(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;
  return { from, to, promotion };
}

export class WasmEngineAdapter implements IEngineAdapter {
  private worker: Worker | null = null;
  private engineType: "hce" | "nnue";
  private pendingResolver: ((res: EngineResult) => void) | null = null;
  private pendingRejecter: ((err: any) => void) | null = null;
  private currentTaskId: number = 0;

  constructor(engineType: "hce" | "nnue") {
    this.engineType = engineType;
    this.initWorker();
  }

  private initWorker() {
    if (typeof Worker === 'undefined') {
      console.warn("[WasmEngineAdapter] Worker is not defined in this environment.");
      return;
    }
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = new WasmWorker();
    this.worker.onmessage = (e: MessageEvent) => {
      const { type, id, result, error } = e.data;
      if (type === 'success' && id === this.currentTaskId) {
        if (error) {
          this.pendingRejecter?.(new Error(error));
        } else {
          const data = result;
          const engineResult: EngineResult = {
            move: parseUciMove(data.move_str),
            engineUsed: data.engine_used || this.engineType,
            thinkTimeMs: data.think_time_ms || 0,
            searchDepth: data.depth || 0,
            evalCp: data.eval_cp || 0,
            noiseApplied: data.noise_applied || 0,
            wasFallback: false,
          };
          this.pendingResolver?.(engineResult);
        }
        this.pendingResolver = null;
        this.pendingRejecter = null;
      }
    };
  }

  async computeMove(request: EngineRequest): Promise<EngineResult> {
    this.cancel();

    if (!this.worker) {
      return Promise.reject(new Error("Wasm worker not available in this environment"));
    }

    return new Promise<EngineResult>((resolve, reject) => {
      this.currentTaskId++;
      this.pendingResolver = resolve;
      this.pendingRejecter = reject;

      const payload = JSON.stringify({
        fen: request.fen,
        engine_type: this.engineType,
        depth: request.depth,
        error_noise_cp: request.errorNoiseCp,
        max_think_time_ms: request.maxThinkTimeMs,
        bot_profile_id: request.botProfileId,
        style: request.style,
        recent_moves: request.recentMoves,
        recent_fens: request.recentFens,
      });

      this.worker?.postMessage({
        id: this.currentTaskId,
        action: 'compute_move',
        payload,
      });
    });
  }

  cancel() {
    if (this.pendingRejecter) {
      const abortErr = new DOMException('The operation was aborted.', 'AbortError');
      this.pendingRejecter(abortErr);
      this.pendingResolver = null;
      this.pendingRejecter = null;
      this.initWorker();
    }
  }

  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingResolver = null;
    this.pendingRejecter = null;
  }

  isReady(): boolean {
    return this.worker !== null;
  }
}
