# Online Multiplayer Ranked & Tournament Structure

This document outlines the design structure, ELO rating tiers, and tournament bracket formats for the competitive stages of Clash of Crowns.

## 1. Casual / Friend Match (Staging Phase — Available)
- **Format:** Custom room creation and joining via a shareable Room ID/link.
- **Matchmaking:** None (manual invite).
- **ELO/Rating:** No rating updates, points are not gained or lost.
- **Goal:** Casual testing, playing with friends, and onboarding.

## 2. Ranked Match Tiers (Production Staging — Beta-Locked)
Ranked matchmaking will pair players within close proximity of their rating. The tier progression system is inspired by competitive games (like BGMI/Free Fire):

### Rating Tiers:
1. **Bronze (V - I):** 1000 - 1399 (Start rating: 1200)
2. **Silver (V - I):** 1400 - 1799
3. **Gold (V - I):** 1800 - 2199
4. **Platinum (V - I):** 2200 - 2599
5. **Diamond (V - I):** 2600 - 2999
6. **Master:** 3000 - 3399
7. **Crown:** 3400 - 3799
8. **Conqueror:** Top 500 active players globally (requires minimum 3800 rating)

### Rules & Authority:
- **Win:** +15 to +30 points (depends on opponent rating).
- **Loss:** -10 to -25 points.
- **Draw:** Rating delta approaches zero (slight adjustments if rating discrepancy is high).
- **Abandon/Timeout/Disconnect:** Treated as a loss (rating penalty applied).
- **Server Authority:** All ELO adjustments must be calculated, cryptographic-signature verified, and saved by the secure Node.js backend to prevent user-side local rating tampering.

---

## 3. Championship Tournaments (Production Staging — Locked)
- **Format:** Double-elimination or Single-elimination brackets (8, 16, or 32 players).
- **Registration:** Requires in-game registration before the event start window.
- **Advance:** Round-robin or bracket advancement controlled authoritatively by the backend server.
- **Rewards:** Unique profile cosmetic trophies, crown points, and leaderboard status.
- **Security:** Requires active Firebase authenticated session and anti-cheat validation checks.
