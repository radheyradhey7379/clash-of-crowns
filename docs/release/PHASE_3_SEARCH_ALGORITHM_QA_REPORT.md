# PHASE 3 — SEARCH ALGORITHM QA REPORT

This report audits the status of the search features within the Rust/Wasm chess engine, proving compliance with technical requirements and clarifying the status of the client’s handwritten engine notes.

---

## 1. Current Bot Depth Values Preserved
No configured bot depths or difficulty configurations were altered in this phase. The existing configurations are recorded below:
- **Beginner**: target depth = `1`
- **Learner**: target depth = `1`
- **Intermediate**: target depth = `2`
- **Hard**: target depth = `3`
- **Master**: target depth = `3`
- **Grandmaster**: target depth = `4`

---

## 2. Search Feature Status Audit

| Search Feature | Status | Description |
| :--- | :--- | :--- |
| **Negamax** | `IMPLEMENTED` | Standard recursive Negamax implementation (under `negamax` in `negamax.rs`). |
| **Alpha-Beta pruning** | `IMPLEMENTED` | Active alpha/beta window tracking and cutoff conditions. |
| **Iterative Deepening** | `IMPLEMENTED` | Progressive depth increments from 1 up to target depth. |
| **Quiescence Search** | `IMPLEMENTED` | Active leaf node capture and promotion resolution to combat the horizon effect. |
| **Move ordering** | `IMPLEMENTED` | Captures, checks, and promotions ordered first to maximize cutoffs. |
| **Time budget control** | `IMPLEMENTED` | Mid-search timeout validation checks. |
| **Magic bitboard** | `IMPLEMENTED` | Leveraged implicitly via the `shakmaty` chess dependency. |
| **FIDE legal rules** | `IMPLEMENTED` | Leveraged implicitly via `shakmaty` rules enforcement. |
| **LMR (Late Move Reduction)** | `NOT IMPLEMENTED` | Quiet late move reductions not used in this build. |
| **TT (Transposition Table)** | `NOT IMPLEMENTED` | Positional hash caching / LRU cache not implemented. |
| **Zobrist hashing** | `NOT IMPLEMENTED` | Repetitions are verified using clean string comparison on FEN prefixes. |

---

## 3. Real SearchDebugInfo Counters
The prebuilt Wasm binary compiled into `wasm_engine_bg.wasm` does not output deep telemetry stats like subnode categories or cutoffs. To maintain safety and prevent UI bloat, these fields are exposed in dev/test via `SearchDebugInfo` using `'UNAVAILABLE_FROM_CURRENT_WASM'` rather than inaccurate placeholders:

```json
[EngineBrain SearchDebugInfo] {
  "searchUsed": "negamax",
  "depthTarget": 1,
  "depthReached": 1,
  "depthSequence": [ 1 ],
  "nodesVisited": "UNAVAILABLE_FROM_CURRENT_WASM",
  "alphaBetaCutoffs": "UNAVAILABLE_FROM_CURRENT_WASM",
  "betaCutoffs": "UNAVAILABLE_FROM_CURRENT_WASM",
  "quiescenceNodes": "UNAVAILABLE_FROM_CURRENT_WASM",
  "quiescenceDepthMax": "UNAVAILABLE_FROM_CURRENT_WASM",
  "transpositionHits": "UNAVAILABLE_FROM_CURRENT_WASM",
  "transpositionStores": "UNAVAILABLE_FROM_CURRENT_WASM",
  "moveOrderingUsed": true,
  "lmrReductions": "UNAVAILABLE_FROM_CURRENT_WASM",
  "timeBudgetMs": 2000,
  "actualTimeMs": 3,
  "stoppedByTimeout": false,
  "returnedBestSoFar": false,
  "selectedMove": "b1c3",
  "evalScore": 50
}
```

---

## 4. Client Note Future-Item Classification Matrix

| Item | Current Status | Launch Need | Future Phase |
| :--- | :--- | :--- | :--- |
| **UCI protocol** | `NOT IMPLEMENTED` | `Optional` | Future multiplayer/realtime sync phase |
| **Prometheus/Grafana** | `NOT IMPLEMENTED` | `Optional` | Future monitoring/scaling phase |
| **DHAT/Valgrind** | `NOT IMPLEMENTED` | `Optional` | Future profiling phase |
| **Tokio server runtime**| `IMPLEMENTED` | `Required` | Core realtime socket support |
| **Obfuscation** | `NOT IMPLEMENTED` | `Optional` | Release packaging stage |
| **FFI safe boundary** | `IMPLEMENTED` | `Required` | handled securely via wasm-bindgen |
| **WASM garbage coll.** | `NOT REQUIRED` | `Optional` | standard rust alloc controls memory |
| **NNUE training** | `NOT IMPLEMENTED`| `Optional` | weights trained offline in python/C++ |
| **NNUE forward pass** | `IMPLEMENTED` | `Required` | feedforward pass executed in Wasm |
| **SIMD/intrinsics** | `NOT IMPLEMENTED`| `Optional` | Future optimization phase |
| **Clipped ReLU** | `NOT IMPLEMENTED`| `Optional` | using standard ReLU in float32 layer |
| **Quantization scaling**| `NOT IMPLEMENTED`| `Optional` | standard f32 weights used |
| **Cargo.toml safety** | `IMPLEMENTED` | `Required` | release profile optimization active |

---

## 5. Test & Compilation Verification
- **Tests Added**: 11 unit tests inside `searchQA.test.ts` verifying Negamax execution, stalemate/checkmate resolution, time limits, deadlock avoidance, and diagnostic output format.
- **Total Tests Passed**: 567 tests.
- **Android Debug APK Hash**: `50740D2A60866974705AECD9108AFBE248217B6FEE14ECC54CEA9E615D7C82D6`
