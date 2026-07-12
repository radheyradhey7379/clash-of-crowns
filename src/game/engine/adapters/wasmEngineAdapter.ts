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
  private pendingRequest: EngineRequest | null = null;
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
          const targetDepth = this.pendingRequest?.depth || 0;
          const completedDepth = data.depth || 0;
          const usedPartial = completedDepth < targetDepth;
          const engineResult: EngineResult = {
            move: parseUciMove(data.move_str),
            engineUsed: data.engine_used || this.engineType,
            thinkTimeMs: data.think_time_ms || 0,
            searchDepth: completedDepth,
            evalCp: data.eval_cp || 0,
            noiseApplied: data.noise_applied || 0,
            wasFallback: false,
            // Pre-release Bug 5 metadata
            move_uci: data.move_str,
            source: 'wasm',
            depth_completed: completedDepth,
            used_partial_result: usedPartial,
            reason: usedPartial ? 'timeout' : 'normal',
          };
          if (data.debug_stats) {
            (engineResult as any).wasmDebugStats = data.debug_stats;
          }
          if (data.hce_debug_info) {
            engineResult.hceDebugInfo = {
              materialScore: data.hce_debug_info.material_score,
              pstScore: data.hce_debug_info.pst_score,
              pstMode: data.hce_debug_info.pst_mode,
              usedPieceTables: data.hce_debug_info.used_piece_tables,
              ignoredPieceTables: data.hce_debug_info.ignored_piece_tables,
              finalHceEval: data.hce_debug_info.final_hce_eval,
            };
          }
          if (data.nnue_debug_info) {
            engineResult.nnueDebugInfo = {
              modelLoaded: data.nnue_debug_info.model_loaded,
              weightsSource: data.nnue_debug_info.weights_source,
              weightsHash: data.nnue_debug_info.weights_hash,
              inputFeaturesCount: data.nnue_debug_info.input_features_count,
              forwardPassUsed: data.nnue_debug_info.forward_pass_used,
              activationType: data.nnue_debug_info.activation_type,
              quantizationType: data.nnue_debug_info.quantization_type,
              rawNnueEval: data.nnue_debug_info.raw_nnue_eval,
              finalNnueEval: data.nnue_debug_info.final_nnue_eval,
            };
          }
          if (data.random_error_debug_info) {
            engineResult.randomErrorDebugInfo = {
              rawEval: data.random_error_debug_info.raw_eval,
              randomFactor: data.random_error_debug_info.random_factor,
              botImpairmentScale: data.random_error_debug_info.bot_impairment_scale,
              randomErrorCpApplied: data.random_error_debug_info.random_error_cp_applied,
              finalEval: data.random_error_debug_info.final_eval,
              formulaUsed: data.random_error_debug_info.formula_used,
              appliedOnce: data.random_error_debug_info.applied_once,
            };
          }
          this.pendingResolver?.(engineResult);
        }
        this.pendingResolver = null;
        this.pendingRejecter = null;
        this.pendingRequest = null;
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
      this.pendingRequest = request;

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
      this.pendingRequest = null;
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
    this.pendingRequest = null;
  }

  isReady(): boolean {
    return this.worker !== null;
  }
}
