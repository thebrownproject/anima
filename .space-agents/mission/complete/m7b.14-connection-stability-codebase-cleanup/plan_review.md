# Implementation Plan Review: Connection Stability

Here is the review of `plan.md` against the requirements in `spec.md`.

### 1. Completeness

- **MISSING Requirements:**
  - **T2.10 (OOM limit) and T2.11 (Array Header crash)**: These are listed in the `API Proxy` task block but completely absent from the Wave sequencing section at the bottom.
  - **T8.5 (Dead session_id)**: Missing entirely from the plan.
  - **T8.11 (backend pytest)**, **T8.24 (SDK version)**, **T8.25 (System prompt bounds)**, **T8.26 (Batch threshold docs)**: Included in the "Sprite Dead Code" task definition, but absent from the actual Steps list in that block.
  - **T6.12 (Upload error handling)**: Mentioned in the task description but missing from the Steps list.
- **VERDICT: REWORK**. Several requirements explicitly listed in the spec were accidentally dropped from the task steps or wave sequencing.

### 2. Task Grouping

- **NOTE (T3.2 and T3.3)**: Combining the message queue (`T3.2`) with the optimistic send fix (`T3.3`) in the same task is logical since they interact heavily with the `send()` return value, but it makes the "Frontend Connection Status" task very large. It might be safer to split the visual indicator (`T3.1`, `T3.9`) from the queue logic to avoid massive file changes in one go.
- **WARNING (T1.4)**: The partial-line TCP frame buffer (`T1.4`) is grouped under the Bridge Critical Connection task. While correct, this touches binary streams, whereas `T1.1-1.3` touch high-level state maps. Combining them increases the risk of regressions in the foundational PR.
- **VERDICT: APPROVE WITH CHANGES**. The macro-level tracks are solid, but a few heavy tasks could be factored down.

### 3. Dependency Accuracy

- **CRITICAL (Sprite Error Handling)**: The plan marks "Sprite Error Handling and I/O Safety" (Wave 4) as dependent on "Sprite Gateway and Runtime Hardening" (Wave 3). This is a false sequential dependency. Offloading large file writes (`T6.8`) and differentiating SDK errors (`T6.9`) can absolutely be done in parallel with adding timeouts (`T6.6`).
- **CRITICAL (Frontend Lint)**: The plan makes "Frontend Lint, Test Fixes" (Wave 5) depend on "State Reconciliation" (Wave 4). Test fixes for `use-stt` and `chat-bar` (`T8.13`) can be fixed immediately in Wave 1; they do not require State Reconciliation to be finished.
- **VERDICT: REWORK**. Unnecessary sequential dependencies artificially lengthen the critical path.

### 4. Wave Sequencing

- **WARNING (Wave 2 vs Wave 3 Checkpoint)**: The Integration Checkpoint occurs after Wave 2. However, Wave 3 contains "Sprite Gateway Scoping" (`T6.1`). If the integration checkpoint passes without the `mission_lock` being moved to the global scope, the test is invalid because concurrent socket overlapping (the very thing being tested) will still break the runtime. `T6.1` MUST be moved up to Wave 1 or 2 before the checkpoint.
- **VERDICT: REWORK**. The checkpoint is positioned incorrectly relative to the concurrency fixes.

### 5. Risk Gaps

- **MISSING RISK (Database Migrations)**: Modifying `observations`, `cards`, and batch insertions concurrently across different agents (Track 7) on a sqlite file while other agents might be interacting with the system introduces high lock-contention risk during automated testing.
- **MISSING RISK (Bridge Proxy Restart)**: Touching `api-proxy.ts` (Wave 1) and checking it before `ensureSpriteProvisioned` (Wave 2) means the bridge will be unstable while developers are actively modifying auth headers.
- **VERDICT: REWORK**. Add SQLite file-contention and Bridge downtime to the risk register.

### 6. Contradictions with Spec

- **CRITICAL (T2.10)**: The spec explicitly states "Bridge runs on 256MB... No unbounded buffers". The plan for `T2.10` says "abort request if over 10MB" but does not explicitly forbid using `Buffer.concat` (which is the root cause of the OOM). The plan must explicitly mandate _streaming_ rejection, not just a length check.
- **VERDICT: REWORK**. Ensure the OOM constraint is strictly mapped to the implementation strategy.

### 7. Test Coverage

- **WARNING (T3.2 Queue)**: The test lists "Messages sent while disconnected are queued". It misses a critical edge case: "Messages sent during `sprite_waking` are queued until `sprite_ready`". Testing only "disconnected" is insufficient.
- **WARNING (T6.4 Send_fn)**: The test says "send_fn swap uses generation counter". It needs an explicit verifiable outcome: "In-flight sends concurrently resolving during a reconnect do not crash the runtime."
- **VERDICT: APPROVE WITH CHANGES**. Add specific edge-case validations to the test criteria.

### 8. Critical Path Bottleneck

- **NOTE**: The plan claims the frontend is the bottleneck (17h). However, if you remove the false dependency of Frontend Lint (Wave 5) waiting for State Reconciliation (Wave 4), the frontend critical path drops by ~2.5h.
- The real bottleneck is the **Bridge Reliability Path**: Bridge Critical Connection (L) -> Auth Hardening (L) -> Integration Checkpoint -> Bridge Test Fixes (L). This serial chain touches the most tightly coupled core routing logic.
- **VERDICT: REWORK**. Recalculate the critical path considering the false dependencies identified in Section 3.

---

### Final Verdict: REWORK

The plan provides an excellent structural foundation, but critical omissions (dropped requirements), false sequential dependencies, and an invalidly positioned integration checkpoint mean it needs a revision before execution begins.
