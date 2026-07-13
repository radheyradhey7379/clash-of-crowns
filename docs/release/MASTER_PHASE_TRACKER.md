# MASTER PHASE TRACKER

This document tracks the status of each phase in the Clash of Crowns Final Technical QA and Completion Plan.

## Baseline Audit (Phase 0)
- **Commit Hash**: `63a7b2d0b373f3dbb68b6c1f42ce8721c67289e8`
- **Unit Test Count**: `537`
- **Build Status**: `BUILD SUCCESSFUL`
- **Current APK Hash**: `8DD06D3ABD89C2CFB0ABEBDA1A04E49B9C555B0C7D94E31629DB7B168DFC5B30`

---

## Phase Status Tracker

| Phase | Description | Status | Target Date / Complete Date | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Project Freeze & Baseline Audit | `PHASE_0_BASELINE_READY` | 2026-07-12 | Baseline metrics gathered. |
| **Phase 1** | Core Gameplay Flow Fix | `PHASE_1_CORE_GAMEPLAY_FLOW_READY` | 2026-07-12 | Core flow verified and tested. |
| **Phase 2** | Engine Runtime Routing Proof | `PHASE_2_ENGINE_RUNTIME_ROUTING_READY` | 2026-07-12 | Engine and evaluator selectors verified. |
| **Phase 3** | Search Algorithm Technical QA | `PHASE_3A_WASM_SEARCH_COUNTERS_READY` | 2026-07-12 | WASM rebuilt with real node counts, cutoffs, and quiescence telemetry. |
| **Phase 4** | NNUE / HCE / PST / Random Error | `PHASE_4_NNUE_HCE_PST_RANDOM_READY` | 2026-07-12 | Centralized bot parameters, synced evaluations, and exposed telemetry. |
| **Phase 5** | Master Cup / RR / Grandmaster | `PHASE_5_CUP_GRANDMASTER_READY` | 2026-07-12 | Robust Round Robin tiebreaks, best-of-3 series progress, and result CTA mappings. |
| **Phase 6** | Payment / Premium / Security | `PHASE_6_PAYMENT_SECURITY_READY` | 2026-07-12 | Centralized product pricing, verified entitlements checks, and robust Firestore rules. |
| **Phase 7** | User-Facing Error Sanitization | `PHASE_7_ERROR_SANITIZATION_READY` | 2026-07-12 | Centralized user-safe error sanitizer and unit tests completed. |
| **Phase 8** | API & Dependency Review | `PHASE_8_API_DEPENDENCY_REVIEW_READY` | 2026-07-12 | Isolated wasm compilation, audited npm packages, and security hardening tests. |
| **Phase 9** | Gameplay Tuning & Playtest Build | `PHASE_9_GAMEPLAY_TUNING_READY` | 2026-07-13 | Simulated 28 matches across all tiers, verified Android performance, and generated playtest APK. |
| **Phase 10** | Final Release Build | `FINAL_SIGNED_AAB_READY_FOR_CLIENT_REVIEW` | 2026-07-13 | Release bundle built, signed using release.keystore, and sign-off report created. |

---

## Known Blockers & Phase Mapping

| Blocker Description | Blocker Category | Target Phase | Status |
| :--- | :--- | :--- | :--- |
| Next level unlock bug under specific sync scenarios | Gameplay Flow | **Phase 1** | Verified in initial fix |
| Retry timer after loss logic resetting | Gameplay Flow | **Phase 1** | Verified in initial fix |
| Guest reset stats causing auto-logout | Session/Auth | **Phase 1** | Verified in initial fix |
| Stale old local cache/backup restore overwriting newer database saves | Session/Auth | **Phase 1** | Verified in initial fix |
| Proof of runtime routing for beginner vs learner vs master etc. | Engine Routing | **Phase 2** | Pending |
| Verify search algorithms (Negamax, Alpha-Beta, Quiescence, ordering) | Search QA | **Phase 3** | Pending |
| NNUE weights validation, HCE evaluator matching, and Random Error formula | Engine Eval | **Phase 4** | Pending |
| Cup/Round Robin deadlock, tie resolution, and GM Boss best-of-3 flow | Career Mode | **Phase 5** | Pending |
| Payment entitlements security and local storage premium bypass rules | Payment Sec | **Phase 6** | Pending |
| Hiding internal errors, RTT debug overlays, and token strings | Sanitization | **Phase 7** | Pending |
