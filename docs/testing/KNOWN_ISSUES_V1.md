# Known Issues (v1.0)

This document outlines features currently disabled or pending, and known technical limitations for the v1.0 Launch.

## Disabled / "Coming Soon" Features
- **Live Multiplayer**: Disabled for v1.0. All public-facing entry points state "Coming Soon."
- **Ranked Arena**: Disabled.
- **Tournaments**: Disabled.
- **Challenge-to-Match**: Social poking works, but users cannot initiate realtime challenges.
- **Admin Email Fallback**: A hardcoded admin email fallback remains active temporarily to avoid breaking existing workflow, but will be removed in a future phase in favor of standard Firebase custom claims.

## Security Limitations
- **Offline Save Authority**: Offline rewards are locally tracked and protected against basic tampering using SHA-256 checksums and incremental match IDs. However, they are not fully server-authoritative. Cryptographic HMAC or server-backed validation will be required in future phases to guarantee absolute security against advanced memory manipulation or decompilation.

## Performance Limitations
- **Low-End Android 3D**: Extremely old or low-end Android devices may experience frame drops in 3D mode. Users are advised to use the "Low Graphics" toggle or remain in 2D mode. Heavy 3D assets are now lazy-loaded to protect 2D players.
- **Stockfish WASM**: Long compute times for Grandmaster tier AI calculations may cause slight device warming. Safety timeouts have been implemented to prevent freezes.
