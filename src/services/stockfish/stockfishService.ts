/**
 * Stockfish Service
 * Manages the Stockfish WASM engine for Elite levels (2000+ Elo)
 */

export class StockfishService {
  private worker: Worker | null = null;
  private onMessage: ((msg: string) => void) | null = null;
  private isReady = false;
  private isInitializing = false;
  private commandQueue: string[] = [];

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

          console.log("[Stockfish] Created local offline Blob worker with injected WASM.");
          return new Worker(jsUrl);
        }
      }
    } catch (err) {
      console.warn("[Stockfish] Failed to create offline Blob worker, using fallback:", err);
    }

    // Fallback to standard path
    return new Worker('/sf.js#sf.wasm,worker');
  }

  private init() {
    if (this.worker || this.isInitializing) return;
    this.isInitializing = true;

    this.createWorker().then((w) => {
      this.worker = w;
      this.isInitializing = false;
      this.worker.onmessage = (e) => {
        if (e.data === 'uciok') this.isReady = true;
        if (this.onMessage) this.onMessage(e.data);
      };
      
      // Flush any commands queued during initialization
      const queue = [...this.commandQueue];
      this.commandQueue = [];
      queue.forEach(cmd => this.worker?.postMessage(cmd));

      this.sendCommand('uci');
      this.sendCommand('isready');
    }).catch((error) => {
      this.isInitializing = false;
      console.error('Failed to initialize Stockfish worker:', error);
    });
  }

  sendCommand(command: string) {
    if (!this.worker) {
      this.commandQueue.push(command);
      this.init();
      return;
    }
    this.worker.postMessage(command);
  }

  async getBestMove(fen: string, depth: number, skillLevel?: number, contempt?: number, maxThinkTimeMs?: number): Promise<string | null> {
    if (!this.worker) {
      this.init();
    }
    
    return new Promise((resolve) => {
      const limitTime = maxThinkTimeMs || 10000;
 
      // 1. Primary stop timeout
      const stopTimeout = setTimeout(() => {
        console.log(`[Stockfish] Calculation exceeded ${limitTime}ms. Stopping search...`);
        this.sendCommand('stop');
      }, limitTime);
 
      // 2. Absolute safety timeout in case worker hangs completely
      const safetyTimeout = setTimeout(() => {
        console.warn('[Stockfish] Completely unresponsive after stop. Force resolving null.');
        this.onMessage = null;
        resolve(null);
      }, limitTime + 1000);
 
      const messageHandler = (msg: string) => {
        if (msg.startsWith('bestmove')) {
          clearTimeout(stopTimeout);
          clearTimeout(safetyTimeout);
          const move = msg.split(' ')[1];
          this.onMessage = null;
          resolve(move === '(none)' ? null : move);
        }
      };
 
      this.onMessage = messageHandler;
      
      this.sendCommand('ucinewgame');
      this.sendCommand('isready');
      
      if (skillLevel !== undefined) {
        this.sendCommand(`setoption name Skill Level value ${skillLevel}`);
      }
      if (contempt !== undefined) {
        this.sendCommand(`setoption name Contempt value ${contempt}`);
      }
      
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);
    });
  }

  stop() {
    this.sendCommand('stop');
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitializing = false;
    this.commandQueue = [];
  }
}



