"""E2E integration test for SDK hooks on a live Sprite.

Runs on-Sprite to verify:
1. All imports resolve (Python 3.13, Sprite env)
2. TranscriptDB + MemoryDB create and initialize
3. HookMatcher builds correctly (SDK type compatibility)
4. All 4 hook callbacks fire with correct signatures
5. Observations written to transcript.db
6. Batch threshold triggers flush_all
7. Hooks never raise (error containment)

Usage (on Sprite):
    cd /workspace && python3 -m tests.test_e2e_hooks

Usage (via exec):
    check-sprite.ts sd-e2e-test "cd /workspace && .venv/bin/python3 -m tests.test_e2e_hooks"
"""

import asyncio
import json
import os
import sys
import tempfile

# ── 1. Import verification ──────────────────────────────────────────────
print("=" * 60)
print("E2E Hook Integration Test")
print("=" * 60)

errors = []


def check(name: str, ok: bool, detail: str = ""):
    status = "PASS" if ok else "FAIL"
    msg = f"  [{status}] {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    if not ok:
        errors.append(name)


print("\n── Imports ──")
try:
    from src.database import TranscriptDB, MemoryDB
    check("database imports", True)
except Exception as e:
    check("database imports", False, str(e))
    sys.exit(1)

try:
    from src.memory.hooks import TurnBuffer, create_hook_callbacks, DEFAULT_BATCH_THRESHOLD
    check("hooks imports", True)
except Exception as e:
    check("hooks imports", False, str(e))
    sys.exit(1)

try:
    from src.runtime import AgentRuntime
    check("runtime imports", True)
except Exception as e:
    check("runtime imports", False, str(e))

try:
    from claude_agent_sdk import HookMatcher, ClaudeAgentOptions
    check("claude_agent_sdk imports", True)
except Exception as e:
    check("claude_agent_sdk imports", False, str(e))
    sys.exit(1)


# ── 2. Database creation ────────────────────────────────────────────────
print("\n── Database ──")


async def run_tests():
    tmpdir = tempfile.mkdtemp(prefix="e2e_hooks_")
    transcript_path = os.path.join(tmpdir, "transcript.db")
    memory_path = os.path.join(tmpdir, "memory.db")

    transcript_db = TranscriptDB(db_path=transcript_path)
    memory_db = MemoryDB(db_path=memory_path)

    await transcript_db.connect()
    await memory_db.connect()
    check("TranscriptDB created", os.path.exists(transcript_path))
    check("MemoryDB created", os.path.exists(memory_path))

    # Verify schema
    obs_table = await transcript_db.fetchone(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='observations'"
    )
    check("observations table exists", obs_table is not None)

    sessions_table = await transcript_db.fetchone(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
    )
    check("sessions table exists", sessions_table is not None)

    learnings_table = await memory_db.fetchone(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='learnings'"
    )
    check("learnings table exists", learnings_table is not None)

    # ── 3. HookMatcher compatibility ────────────────────────────────────
    print("\n── HookMatcher ──")

    buffer = TurnBuffer()
    flush_count = 0

    class MockProcessor:
        async def flush_all(self):
            nonlocal flush_count
            flush_count += 1

    processor = MockProcessor()
    hooks = create_hook_callbacks(transcript_db, processor, buffer, batch_threshold=3)
    check("create_hook_callbacks returns dict", isinstance(hooks, dict))
    check("has 4 hooks", len(hooks) == 4, f"got {len(hooks)}")

    # Build HookMatcher dict exactly as runtime.py does
    try:
        hooks_dict = {
            "UserPromptSubmit": [
                HookMatcher(matcher=None, hooks=[hooks["on_user_prompt_submit"]]),
            ],
            "PostToolUse": [
                HookMatcher(matcher="*", hooks=[hooks["on_post_tool_use"]]),
            ],
            "Stop": [
                HookMatcher(matcher=None, hooks=[hooks["on_stop"]]),
            ],
            "PreCompact": [
                HookMatcher(matcher=None, hooks=[hooks["on_pre_compact"]]),
            ],
        }
        check("HookMatcher dict builds", True)
    except Exception as e:
        check("HookMatcher dict builds", False, str(e))

    # Verify HookMatcher accepts our format
    for hook_name, matchers in hooks_dict.items():
        m = matchers[0]
        check(
            f"HookMatcher({hook_name})",
            hasattr(m, "matcher") and hasattr(m, "hooks"),
            f"matcher={m.matcher!r}, hooks={len(m.hooks)}",
        )

    # Verify it can be passed to ClaudeAgentOptions
    try:
        opts = ClaudeAgentOptions(
            max_turns=1,
            permission_mode="bypassPermissions",
            cwd="/tmp",
            hooks=hooks_dict,
        )
        check("ClaudeAgentOptions accepts hooks", True)
    except Exception as e:
        check("ClaudeAgentOptions accepts hooks", False, str(e))

    # ── 4. Hook callback firing ─────────────────────────────────────────
    print("\n── Hook Callbacks ──")

    # UserPromptSubmit
    result = await hooks["on_user_prompt_submit"](
        {"prompt": "What is 2+2?"}, "tool-123", {}
    )
    check("UserPromptSubmit returns {}", result == {})
    check("UserPromptSubmit buffers prompt", buffer.user_message == "What is 2+2?")

    # PostToolUse
    result = await hooks["on_post_tool_use"](
        {
            "tool_name": "Read",
            "tool_input": {"file_path": "/tmp/test.txt"},
            "tool_response": "file contents here",
        },
        "tool-456",
        {},
    )
    check("PostToolUse returns {}", result == {})
    check("PostToolUse buffers tool call", len(buffer.tool_calls) == 1)
    check(
        "PostToolUse captures tool_name",
        buffer.tool_calls[0]["tool"] == "Read",
    )

    # Simulate agent response (runtime._handle_sdk_message does this)
    buffer.append_agent_response("The answer is 4.")

    # Stop — this writes the observation
    result = await hooks["on_stop"](
        {"stop_hook_active": True}, None, {}
    )
    check("Stop returns {}", result == {})

    # Verify observation written
    obs = await transcript_db.fetchone("SELECT * FROM observations WHERE sequence_num = 1")
    check("observation written to transcript.db", obs is not None)
    if obs:
        check("observation has user_message", obs["user_message"] == "What is 2+2?")
        check(
            "observation has tool_calls",
            "Read" in obs["tool_calls_json"],
        )
        check("observation has agent_response", obs["agent_response"] == "The answer is 4.")
        check("observation unprocessed", obs["processed"] == 0)

    # Verify buffer cleared after Stop
    check("buffer cleared after Stop", buffer.user_message is None)
    check("buffer tool_calls cleared", len(buffer.tool_calls) == 0)
    check("buffer agent_response cleared", buffer.agent_response == "")

    # ── 5. Batch threshold ──────────────────────────────────────────────
    print("\n── Batch Threshold ──")

    # threshold=3, we already did 1 turn. Do 2 more.
    for i in range(2):
        await hooks["on_user_prompt_submit"]({"prompt": f"turn {i+2}"}, None, {})
        buffer.append_agent_response(f"response {i+2}")
        await hooks["on_stop"]({"stop_hook_active": True}, None, {})

    check("batch triggered at threshold=3", flush_count == 1, f"flush_count={flush_count}")

    # Verify 3 observations total
    all_obs = await transcript_db.fetchall("SELECT * FROM observations ORDER BY sequence_num")
    check("3 observations in transcript.db", len(all_obs) == 3, f"got {len(all_obs)}")

    # ── 6. PreCompact emergency flush ───────────────────────────────────
    print("\n── PreCompact ──")

    flush_before = flush_count
    result = await hooks["on_pre_compact"](
        {"trigger": "auto"}, None, {}
    )
    check("PreCompact returns {}", result == {})
    check("PreCompact calls flush_all", flush_count == flush_before + 1)

    # ── 7. Error containment ────────────────────────────────────────────
    print("\n── Error Containment ──")

    # Close DB to force errors, verify hooks don't raise
    await transcript_db.close()

    try:
        result = await hooks["on_stop"]({"stop_hook_active": True}, None, {})
        check("Stop doesn't raise on DB error", True, f"returned {result}")
    except Exception as e:
        check("Stop doesn't raise on DB error", False, str(e))

    try:
        result = await hooks["on_pre_compact"]({"trigger": "auto"}, None, {})
        check("PreCompact doesn't raise on error", True)
    except Exception as e:
        check("PreCompact doesn't raise on error", False, str(e))

    # ── Cleanup ─────────────────────────────────────────────────────────
    await memory_db.close()

    # Remove temp files
    import shutil
    shutil.rmtree(tmpdir, ignore_errors=True)

    return len(errors)


# ── Run ─────────────────────────────────────────────────────────────────
fail_count = asyncio.run(run_tests())

print("\n" + "=" * 60)
if fail_count == 0:
    print(f"ALL TESTS PASSED")
else:
    print(f"{fail_count} TESTS FAILED: {', '.join(errors)}")
print("=" * 60)
sys.exit(1 if fail_count else 0)
