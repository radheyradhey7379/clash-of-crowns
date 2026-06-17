# App Flow Document - Clash of Crowns

## 1. Complete Screen Map (APP_FLOW)
The interface is structured as a robust single-page application router mapping the following screen states (`AppScreen`):

```
       [ Splash Screen ]  ------ (Unauthenticated) ----->  [ Login Screen ]
               |                                                   |
         (Auto Auth)                                           (Google)
               |                                                   |
               +---------------------> [ Home Screen ] <-----------+
                                               |
       +--------------------+------------------+-------------------+-------------------+
       |                    |                  |                   |                   |
[ Level Select ]     [ Learn/Academy ]  [ Leaderboard ]     [ Profile/Stats ]   [ Customise ]
       |                    |                  |                   |                   |
   (Proceed)             (Select)          (Rankings)          (Analytics)       (Skins/Themes)
       |                    |                  +-------------------+                   |
[ Game Screen ]      [ Learn Detail ]                                           [ Premium ]
       |                                                                               |
   (Review)                                                                        (Purchase)
       |
[ Gameplay Review ]
```

---

## 2. Granular Navigation & Screen State Handlers

### A. Splash Screen (`Splash`)
*   **Purpose:** Initial loading screen with chess iconography and animated background titles.
*   **Behavior:** Checks context for pre-existing auth tokens or guest storage. Redirects to `Login` if empty, otherwise loads user preferences and sends the user direct to the `Home` dashboard.

### B. Login Screen (`Login`)
*   **Purpose:** Secure landing view for user entry.
*   **Action buttons:**
    *   **Google Auth:** Triggers Google popup auth or Capacitor native sign-in.
    *   **Guest Entry:** Sets up an ephemeral profile allowing immediate gameplay, syncing data with local storage.

### C. Home Screen (`Home`)
*   **Purpose:** Primary cockpit dashboard of the game.
*   **Main Navigation Paths:**
    *   **Play Campaign:** Moves to `LevelSelect` screen.
    *   **Academy:** Moves to `Learn` screen.
    *   **Leaderboards:** Moves to `Leaderboard` panel.
    *   **Settings / Skins:** Moves to `Settings` / `Customise` or `Profile`.
*   **Global Layout:** Houses the atmospheric BGM Controller sidebar.

### D. Level Select Screen (`LevelSelect`)
*   **Purpose:** Visual stage-wise progression selector.
*   **Structure:** Displays the 27 progression tiles grouped across 3 tiers (Beginner, Intermediate, Grandmaster).
*   **Behavior:** Locks/unlocks tiers based on the player's current Elo score or level progress. Pressing a stage unlocks the launch option to proceed to the main Arena.

### E. Game Screen (`Game`)
*   **Purpose:** The central chessboard scene.
*   **Dual View Toggle:** Seamless switch button from full **3D immersive model rendering** (orbit camera enabled) to high-performance flat **2D board mode** for rapid competitive play.
*   **Gameplay actions:**
    *   **Mute BGM/SFX:** Quick toggle sound controls directly on the HUD.
    *   **Undo Move:** Rewinds chess state (uses daily credits for Guest/Standard users; unlimited for Premium).
    *   **Draw/Resign:** Terminates the current matchup, triggering Elo adjust popups.
    *   **Hint:** Suggestions triggered via engine evaluation (Level 27 engines block hints).

### F. Learn Screen & Learn Detail Screen (`Learn` / `LearnDetail`)
*   **Purpose:** Dedicated academy portal.
*   **Actions:** Users click visual tutorial topics (Pawn Structures, Endgame patterns, Opening gambits). This opens high-fidelity training chess layouts where speech narration explains the optimal tactical solutions.

---

## 3. Boundary, Error, & Empty States

*   **Offline State:** If the network goes completely down, UI components automatically hide Google cloud features (like leaderboard lookups or real-time ranking registers). A local cached status warning appears, letting the user know they can still play matches and that game progress will run on local storage.
*   **Autoplay Blockade State:** Modern browsers block background music by default until user interaction occurs. The `BGMPlayer` captures the user's very first click anywhere on the interface and automatically unlocks audio play loops.
*   **Payment Failure State:** If a Stripe session fails or gets cancelled, users are cleanly returned to the `Customise` or `Premium` panel with a soft inline modal toast alerting them to retry safely.
