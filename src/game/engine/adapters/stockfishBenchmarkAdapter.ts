import { IEngineAdapter, EngineRequest, EngineResult } from '../types';
import { StockfishService } from '../../../services/stockfish/stockfishService';

function parseUciMove(uci: string): { from: string; to: string; promotion?: string } | null {
  if (!uci || uci.length < 4) return null;
  const from = uci.substring(0, 2);
  const to = uci.substring(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;
  return { from, to, promotion };
}

export class StockfishBenchmarkAdapter implements IEngineAdapter {
  private service: StockfishService | null = null;
  private cancelled = false;

  constructor() {
    this.service = new StockfishService();
  }

  async computeMove(request: EngineRequest): Promise<EngineResult> {
    this.cancelled = false;
    
    if (!this.service) {
      throw new Error("Stockfish service already disposed");
    }
    
    const start = performance.now();
    // Default to a benchmark skill level. We don't apply errorNoiseCp here because
    // it's a benchmark engine.
    const skillLevel = 20; 
    const contempt = 0;
    
    const uciMove = await this.service.getBestMove(
      request.fen,
      request.depth,
      skillLevel,
      contempt,
      request.maxThinkTimeMs
    );
    
    if (this.cancelled) {
      throw new Error('AbortError');
    }

    return {
      move: parseUciMove(uciMove),
      engineUsed: 'stockfish_benchmark',
      thinkTimeMs: performance.now() - start,
      searchDepth: request.depth,
      evalCp: 0, // StockfishService doesn't currently return eval
      noiseApplied: 0,
      wasFallback: false
    };
  }

  cancel(): void {
    this.cancelled = true;
    this.service?.stop();
  }

  dispose(): void {
    this.cancel();
    this.service?.terminate();
    this.service = null;
  }

  isReady(): boolean {
    return this.service !== null;
  }
}
