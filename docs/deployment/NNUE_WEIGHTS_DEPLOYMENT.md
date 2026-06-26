# NNUE Weights Deployment Guide

## Overview
This document outlines the deployment strategy for the Clash of Crowns Rust Engine and its accompanying Neural Network (`.nnue`) weight files. Because `.nnue` files can become quite large, we follow strict rules regarding their deployment and version control.

## 1. Version Control Rules
> [!WARNING]
> **DO NOT commit massive `.nnue` files into the main git repository.**

- **Why:** Large binary files bloat the `.git` history, making clones slow and pushing repository sizes over GitHub's limits.
- **Where they live locally:** The exported model should live in `data/nnue/exports/best_model.nnue`. Ensure `data/nnue/exports/` is in `.gitignore` if the model exceeds standard limits (though at ~820KB currently, it is acceptable, any larger unquantized models must not be committed).

## 2. Server Configuration

### Frontend (Vite)
The frontend UI (React/Vite) needs to know where the Rust backend is deployed.
Set the `VITE_RUST_ENGINE_URL` environment variable.
- **Local:** `VITE_RUST_ENGINE_URL=http://localhost:3030`
- **Production:** `VITE_RUST_ENGINE_URL=https://clash-of-crowns-engine.your-domain.com`

### Backend (Rust / Render.com or similar)
The Rust backend must know where to look for the model.
Set the `NNUE_WEIGHTS_PATH` environment variable on the server.
- **Local:** `$env:NNUE_WEIGHTS_PATH="../data/nnue/exports/best_model.nnue"`
- **Production (Render / AWS):** `NNUE_WEIGHTS_PATH=/etc/secrets/best_model.nnue` (or a persistent disk path).

## 3. Deployment Steps (e.g., Render.com)

1. **Host the weights externally:** Upload your `best_model.nnue` to a secure bucket (like AWS S3, Cloudflare R2, or a Secret File in Render).
2. **Download on Build:** If using a build script, add a step to `curl` or `wget` the `.nnue` file from your bucket into a known directory during the container build phase.
3. **Set the Path:** Configure the server environment variable `NNUE_WEIGHTS_PATH` to point to the downloaded file.
4. **Run the Binary:** Execute the Rust binary `clash-of-crowns-realtime`.

## 4. Fallback Behavior
The Rust backend is designed with extreme fault-tolerance regarding NNUE weights.

- **Missing Weights:** If `NNUE_WEIGHTS_PATH` is not set, or the file does not exist, the Rust engine logs an error and automatically falls back to **Placeholder Mode** (Heuristic dummy evaluation).
- **Invalid Weights:** If the file is corrupt, has a bad header, or an invalid checksum, it rejects the file, logs an error, and falls back to **Placeholder Mode**.
- **Transparency:** The frontend always receives `weights_status` (`trained` or `placeholder`) and `inference_mode` (`tensor` or `placeholder`) from the `/engine/move` endpoint, ensuring you can visually debug if the production deployment successfully loaded the model.
