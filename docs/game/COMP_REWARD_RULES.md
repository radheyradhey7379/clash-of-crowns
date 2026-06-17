# Comp Career Reward Rules (Phase 33A)

## Base Match Rewards
- **Win**: 50 Coins, 100 XP
- **Draw**: 20 Coins, 40 XP
- **Loss**: 0 Coins, 10 XP

## Milestone Rewards (Idempotent)
Milestone rewards are awarded exactly once per account, preventing players from manipulating their local save to claim bonuses repeatedly. This is tracked via `claimedTierRewards` and `claimedCupRewards`.

- **Tier Unlock**: +200 Coins
  - Awarded when a player completes the final character of a tier and unlocks the next tier.
  - *Exception*: Unlocking the "Core" tier (default) does not grant an unlock bonus.
- **Master Cup Completion**: +500 Coins
  - Awarded when a player wins 3 out of 4 matches in a specific Master Cup.
  - Tracked uniquely per Cup (1, 2, 3).
- **Grandmaster Defeated**: Badge "Grandmaster Boss Slayer"
  - Awarded for winning the Best-of-3 Boss series against the Crownless King.

## Security and Integrity
- **Note**: Offline rewards are tamper-resistant using SHA-256 checksums and incremental ID tracking, but they are not fully server-authoritative. A future phase should add HMAC/server-backed verification for complete cryptographically secure rewards.
- Impossibly large rewards are clipped by the `matchFlowService` (max +750 Coins, max +150 XP, max +50 Elo) and flagged to the security log.
