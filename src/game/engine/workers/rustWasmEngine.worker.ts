import init, { compute_move, validate_move, simulate_round_robin, get_engine_info } from '../wasm-pkg/wasm_engine.js';
import wasmUrl from '../wasm-pkg/wasm_engine_bg.wasm?url';

let wasmInitialized = false;
const initPromise = (async () => {
  try {
    await init(wasmUrl);
    wasmInitialized = true;
    self.postMessage({ type: 'ready' });
  } catch (err) {
    console.error("[Wasm Worker] Failed to initialize Wasm engine:", err);
    self.postMessage({ type: 'error', error: String(err) });
  }
})();

self.onmessage = async (e: MessageEvent) => {
  await initPromise;
  if (!wasmInitialized) {
    self.postMessage({ type: 'error', error: 'Wasm not initialized' });
    return;
  }

  const { id, action, payload } = e.data;

  try {
    let resultStr = '';
    if (action === 'compute_move') {
      resultStr = compute_move(payload);
    } else if (action === 'validate_move') {
      resultStr = validate_move(payload);
    } else if (action === 'simulate_round_robin') {
      resultStr = simulate_round_robin(payload);
    } else if (action === 'get_engine_info') {
      resultStr = get_engine_info();
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    const parsed = JSON.parse(resultStr);
    self.postMessage({ type: 'success', id, result: parsed });
  } catch (err) {
    self.postMessage({ type: 'success', id, error: String(err) });
  }
};
