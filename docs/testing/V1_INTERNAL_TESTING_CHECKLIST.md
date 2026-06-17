# V1.0 Internal Testing Checklist

## Test Environments
- `[ ]` Low-end Android Device
- `[ ]` Mid-range Android Device
- `[ ]` High-end Android Device (with Notch/Cutout screen)
- `[ ]` Offline Mode (Airplane Mode enabled)
- `[ ]` Weak/Spotty Internet Connection

## System & Connectivity
- `[ ]` **First Install**: App installs and launches to the title screen smoothly without infinite loading or white screens.
- `[ ]` **App Launch**: Booting the app is responsive. Heavy 3D assets do not lock up the initial 2D load.
- `[ ]` **Force Update Allowed**: Simulating a valid version passes the version gate securely.
- `[ ]` **Maintenance Mode**: Simulating maintenance mode triggers the blocking screen.
- `[ ]` **Soft Update**: Simulating a recommended update displays the skippable prompt.
- `[ ]` **Offline Fallback**: Disconnecting the internet and starting the app loads the local cached save safely. Stockfish still functions natively offline.
- `[ ]` **App Restart & Backgrounding**: App restores properly after being sent to the background.

## UI, Performance & Experience
- `[ ]` **2D Gameplay**: Board functions fast and responsively. 3D assets do not load unnecessarily in the background.
- `[ ]` **3D Gameplay**: Toggling to 3D mode dynamically loads the components. No massive stutters or crashes upon toggle.
- `[ ]` **Low Graphics Mode**: Shadows and post-processing disabled correctly, improving framerate.
- `[ ]` **Audio**: Background music defaults to off and respects user toggles. `preload="none"` optimization verified; no battery-drain from unused audio.
- `[ ]` **Battery/Heat**: Verify that a 15-minute 3D game session does not cause extreme thermal throttling.

## Comp Career Progression
- `[ ]` **Fresh Career**: Initial save creates safely, with default Core tier unlocked.
- `[ ]` **First Win**: Completing the first Core AI match grants 50 Coins, 100 XP, unlocks the next AI level, and writes to Firestore (if online).
- `[ ]` **Locked Character**: Editing local save file to bypass progression directly blocks the match from loading.
- `[ ]` **Tier Transition**: Beating the final character in Core tier unlocks Beginner tier and grants the +200 Coin idempotent bonus.
- `[ ]` **Master Cup Reachable**: Verify progression reaches Master and triggers Cup flow.
- `[ ]` **Duplicate Reward Blocked**: Attempting to claim the same tier unlock bonus twice (by local save manipulation) awards 0 duplicate bonus coins.

## Save Migration & Security
- `[ ]` **Old Save Migration**: Loading a v0.9 save migrates seamlessly into the new `saveVersion: 2` state. Missing reward arrays are successfully inferred without crashing.
- `[ ]` **Corrupted Save Repair**: Invalid JSON / tampered checksum save file automatically falls back to backup or fresh state.
- `[ ]` **Cloud Save Upload**: Valid saves sync to Firebase successfully.
- `[ ]` **Suspicious Save Block**: Forging impossible `totalMatchesCompleted` on a new `saveVersion >= 2` triggers `high` severity block.
- `[ ]` **Leaderboard Data**: Only valid Comp mode matches populate the global leaderboard.

## Disabled Features Check
- `[ ]` **Multiplayer/Arena**: Buttons explicitly state "Coming Soon". No hidden navigation bypasses.
- `[ ]` **Challenge-to-Match**: Social poking cannot initiate an unauthorized realtime match.
- `[ ]` **Rust Server**: Rust realtime networking module makes zero connection attempts since it is disabled via environment variables.
