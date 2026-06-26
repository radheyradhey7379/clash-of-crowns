# EngineBrain Manual Gameplay Test Checklist

To ensure the new `EngineBrain` architecture completely honors our routing logic, noise tables, and performance requirements without using deprecated legacy paths, please perform the following tests manually in the UI. 

For maximum observability, **run the Vite server in DEV mode (`npm run dev`) and open your Browser Console** to look for the `[EngineBrain]` debug routing logs.

## Tests to Execute

### 1. Beginner bot plays using HCE
- **Action**: Start a new match against the "Beginner 1" AI.
- **Verification**: 
  - Observe `[EngineBrain] Routing beginner bot 'beginner_1' -> hce engine` in the browser console.
  - The bot should make reasonable beginner-level moves (mostly random with basic captures).

### 2. Learner bot plays using HCE
- **Action**: Start a new match against the "Learner 1" AI.
- **Verification**: 
  - Observe `[EngineBrain] Routing learner bot 'learner_1' -> hce engine` in the browser console.

### 3. Intermediate calls /engine/move
- **Action**: Start a match against the "Intermediate 1" AI.
- **Verification**:
  - Observe `[EngineBrain] Routing intermediate bot 'intermediate_1' -> nnue engine`.
  - Check the Network tab in your DevTools to verify a POST request is made to `VITE_RUST_ENGINE_URL/engine/move`.
  - The rust backend should respond with a valid move and `weights_status: "placeholder"`.

### 4. Hard calls /engine/move
- **Action**: Start a match against the "Hard 1" AI.
- **Verification**:
  - Observe `[EngineBrain] Routing hard bot 'hard_1' -> nnue engine`.
  - Verify network call and valid moves.

### 5. Master calls /engine/move
- **Action**: Start a match against the "Master 1" AI.
- **Verification**:
  - Observe `[EngineBrain] Routing master bot 'master_1' -> nnue engine`.

### 6. Grandmaster calls /engine/move with zero noise
- **Action**: Start a match against the "Crownless King" (Grandmaster) AI.
- **Verification**:
  - Observe the main log: `[EngineBrain] Routing grandmaster bot 'grandmaster_1' -> nnue engine`.
  - Also observe the specific zero noise log: `[EngineBrain] Routing Grandmaster bot 'grandmaster_1' with ZERO errorNoiseCp`.
  - Check the Network tab payload payload: `error_noise_cp` must strictly equal `0`.

### 7. Exit during AI thinking cancels safely
- **Action**: While playing against any intermediate+ bot, hit the "Back/Exit" button exactly while the AI is "Thinking...".
- **Verification**:
  - The app must safely exit to the menu without throwing a crash or unhandled promise rejection.
  - If the network call resolves *after* you have exited, it should safely ignore the response.

### 8. Cup Round Robin creates 2 AI + 1 player
- **Action**: Open the Cup Menu and enter a cup.
- **Verification**:
  - Ensure the participants display properly as you + 2 distinct AI characters.

### 9. AI-vs-AI cup match uses /engine/simulate real loop
- **Action**: During a Cup, if you hit an AI vs AI matchup, click "Simulate Match".
- **Verification**:
  - Verify a POST network call is made to `VITE_RUST_ENGINE_URL/engine/simulate`.
  - Wait 1-10 seconds for the backend to run the internal loop.
  - The response should contain a real `result`, `reason`, `move_count`, and `final_fen`. 
  - Verify the Cup brackets visually update with the win/loss/draw outcome.

### 10. Stockfish benchmark does not load during normal gameplay
- **Action**: Play through 10-15 moves against any standard bot.
- **Verification**:
  - The Browser Console should NEVER display `[Stockfish] Engine spawned` or `stockfish.js` worker initializations, proving that Stockfish remains strictly a benchmark/helper tool.
