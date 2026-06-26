# NNUE Tensor Manual Gameplay Results

**Target Model:** `best_model.nnue`
**Engine:** Rust `clash-of-crowns-realtime`
**Status:** Pending Manual Verification

## Overview
This document tracks the manual gameplay verification required to promote the Tensor NNUE model to production.
Follow the instructions below to run these tests locally, then check off the boxes and fill in the table.

## Manual Testing Instructions

1. **Start the Backend:**
   Open a terminal, navigate to `src-rust`, set the weights path, and start the engine:
   ```bash
   cd src-rust
   $env:NNUE_WEIGHTS_PATH="../data/nnue/exports/best_model.nnue"
   cargo run
   ```

2. **Start the Frontend:**
   Open another terminal, navigate to the root, and start the Vite dev server:
   ```bash
   npm run dev
   ```

3. **Play the matches:**
   Navigate to the local server in your browser and play against the bots specified in the table below. Open the developer console (`F12`) to verify the engine logs if needed.

## Results Table

Please mark the checkboxes `[x]` when completed, and fill in the observations.

| Test Case | Engine | Weights Status | Mode | Response Time | Legal Move Stability | Difficulty Feel | Freezes / Crashes | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Intermediate Bot** (`errorNoiseCp = 40`) | `nnue` | `trained` | `tensor` | TBD | TBD | TBD | TBD | [ ] |
| **2. Hard Bot** (`errorNoiseCp = 20`) | `nnue` | `trained` | `tensor` | TBD | TBD | TBD | TBD | [ ] |
| **3. Master Bot** (`errorNoiseCp = 10`) | `nnue` | `trained` | `tensor` | TBD | TBD | TBD | TBD | [ ] |
| **4. Grandmaster Bot** (`errorNoiseCp = 0`) | `nnue` | `trained` | `tensor` | TBD | TBD | TBD | TBD | [ ] |
| **5. Cup Round Robin** | `nnue` | `trained` | `tensor` | TBD | TBD | TBD | TBD | [ ] |
| **6. AI-vs-AI Simulation** | `nnue` | `trained` | `tensor` | TBD | TBD | TBD | TBD | [ ] |
| **7. Android Device Smoothness** (via Capacitor) | `nnue` | `trained` | `tensor` | TBD | TBD | TBD | TBD | [ ] |
| **8. Exit/Cancel mid-thought** | `nnue` | `trained` | `tensor` | N/A | TBD | N/A | TBD | [ ] |
| **9. Backend Restart Fallback** (Kill & Restart Rust) | `nnue` | `trained` | `tensor` | N/A | TBD | N/A | TBD | [ ] |
| **10. Invalid Weights Fallback** (Change `NNUE_WEIGHTS_PATH` to invalid file) | `nnue` | `placeholder` | `placeholder` | N/A | TBD | N/A | TBD | [ ] |

## Conclusion
Once this table is fully filled out and passes all checks, the Promotion Decision document will be updated to `PRODUCTION_CANDIDATE`.
