import { StockfishEvalResult, AnalysisProgress } from '../analysis/analysisTypes';

export class StockfishAnalysisService {
  private worker: Worker | null = null;
  private isReady = false;
  private isInitializing = false;
  private commandQueue: string[] = [];
  private onMessage: ((msg: string) => void) | null = null;
  private isDisposed = false;

  constructor() {
    this.init();
  }

  private async createWorker(): Promise<Worker> {
    try {
      if (typeof window !== 'undefined' && typeof caches !== 'undefined') {
        const cache = await caches.open('clash-offline-assets').catch(() => null);
        let jsResponse = cache ? await cache.match('./sf.js') : null;
        let wasmResponse = cache ? await cache.match('./sf.wasm') : null;

        // Fetch fallbacks if not in cache (e.g. first run or skipped download)
        if (!jsResponse) {
          jsResponse = await fetch('./sf.js').catch(() => null);
        }
        if (!wasmResponse) {
          wasmResponse = await fetch('./sf.wasm').catch(() => null);
        }

        if (jsResponse && wasmResponse) {
          const wasmBlob = await wasmResponse.blob();
          const wasmUrl = URL.createObjectURL(wasmBlob);
          
          let jsText = await jsResponse.text();
          // Replace relative wasm loading with the compiled blob url
          jsText = jsText.replace('w="stockfish.wasm"', `w="${wasmUrl}"`);

          const jsBlob = new Blob([jsText], { type: 'application/javascript' });
          const jsUrl = URL.createObjectURL(jsBlob);

          console.log("[Stockfish Analysis] Created local offline Blob worker with injected WASM.");
          return new Worker(jsUrl);
        }
      }
    } catch (err) {
      console.warn("[Stockfish Analysis] Failed to create offline Blob worker, using fallback:", err);
    }

    // Fallback to standard path
    return new Worker('/sf.js#sf.wasm,worker');
  }

  private init() {
    if (this.worker || this.isInitializing || this.isDisposed) return;
    this.isInitializing = true;

    this.createWorker().then((w) => {
      if (this.isDisposed) {
        w.terminate();
        return;
      }
      this.worker = w;
      this.isInitializing = false;
      this.worker.onmessage = (e) => {
        const msg = e.data;
        if (msg === 'uciok') this.isReady = true;
        if (this.onMessage) this.onMessage(msg);
      };
      
      // Flush queued commands
      const queue = [...this.commandQueue];
      this.commandQueue = [];
      queue.forEach(cmd => this.worker?.postMessage(cmd));

      this.sendCommand('uci');
      this.sendCommand('isready');
    }).catch((error) => {
      this.isInitializing = false;
      console.error('[Stockfish Analysis] Failed to initialize worker:', error);
    });
  }

  private sendCommand(command: string) {
    if (this.isDisposed) return;
    if (!this.worker) {
      this.commandQueue.push(command);
      this.init();
      return;
    }
    this.worker.postMessage(command);
  }

  /**
   * Run Stockfish on a specific FEN to get evaluation and best move
   */
  async analyzePosition(fen: string, depth: number, maxThinkTimeMs = 3000): Promise<StockfishEvalResult> {
    if (this.isDisposed) {
      throw new Error('[Stockfish Analysis] Service disposed');
    }
    if (!this.worker) {
      this.init();
    }

    return new Promise((resolve) => {
      let lastEval: StockfishEvalResult = {
        evalCp: 0,
        bestMoveUci: '',
        isMateScore: false,
        mateIn: null,
        depth: 0,
        pv: []
      };

      const limitTime = maxThinkTimeMs;
      const stopTimeout = setTimeout(() => {
        this.sendCommand('stop');
      }, limitTime);

      const messageHandler = (msg: string) => {
        if (msg.startsWith('info') && msg.includes('score')) {
          const parts = msg.split(' ');
          
          // Parse depth
          const depthIdx = parts.indexOf('depth');
          if (depthIdx !== -1 && depthIdx + 1 < parts.length) {
            lastEval.depth = parseInt(parts[depthIdx + 1], 10);
          }

          // Parse score
          const scoreIdx = parts.indexOf('score');
          if (scoreIdx !== -1 && scoreIdx + 2 < parts.length) {
            const scoreType = parts[scoreIdx + 1]; // 'cp' or 'mate'
            const scoreVal = parseInt(parts[scoreIdx + 2], 10);
            
            if (scoreType === 'cp') {
              lastEval.evalCp = scoreVal;
              lastEval.isMateScore = false;
              lastEval.mateIn = null;
            } else if (scoreType === 'mate') {
              lastEval.evalCp = scoreVal > 0 ? 10000 : -10000;
              lastEval.isMateScore = true;
              lastEval.mateIn = scoreVal;
            }
          }

          // Parse PV (principal variation)
          const pvIdx = parts.indexOf('pv');
          if (pvIdx !== -1) {
            lastEval.pv = parts.slice(pvIdx + 1);
          }
        }

        if (msg.startsWith('bestmove')) {
          clearTimeout(stopTimeout);
          const parts = msg.split(' ');
          const bestMove = parts[1];
          lastEval.bestMoveUci = bestMove === '(none)' ? '' : bestMove;
          this.onMessage = null;
          resolve(lastEval);
        }
      };

      this.onMessage = messageHandler;

      this.sendCommand('ucinewgame');
      this.sendCommand('isready');
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);
    });
  }

  terminate() {
    this.isDisposed = true;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.isInitializing = false;
    this.commandQueue = [];
    this.onMessage = null;
  }

  dispose() {
    this.terminate();
  }
}
