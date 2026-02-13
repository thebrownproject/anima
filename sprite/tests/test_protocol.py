"""Tests for protocol type guards — state_sync, expanded canvas actions, optional fields."""

import json
import pytest

from src.protocol import (
    is_canvas_interaction,
    is_canvas_update,
    is_mission_message,
    is_protocol_message,
    is_state_sync,
    parse_message,
)


def base_msg(msg_type: str, payload: dict) -> dict:
    return {
        "type": msg_type,
        "id": "test-uuid-1234",
        "timestamp": 1707800000000,
        "payload": payload,
    }


class TestIsStateSync:
    """is_state_sync validates well-formed state_sync messages."""

    valid_payload = {
        "stacks": [{"id": "stack-1", "name": "My Stack"}],
        "active_stack_id": "stack-1",
        "cards": [{
            "id": "card-1",
            "stack_id": "stack-1",
            "title": "Test Card",
            "blocks": [{"id": "b1", "type": "text", "content": "hello"}],
            "size": "medium",
            "position": {"x": 0, "y": 0},
            "z_index": 1,
        }],
        "chat_history": [{"id": "msg-1", "role": "user", "content": "Hi", "timestamp": 1000}],
    }

    def test_valid_state_sync(self):
        msg = base_msg("state_sync", self.valid_payload)
        assert is_state_sync(msg) is True

    def test_empty_arrays(self):
        msg = base_msg("state_sync", {
            "stacks": [],
            "active_stack_id": "stack-1",
            "cards": [],
            "chat_history": [],
        })
        assert is_state_sync(msg) is True

    def test_missing_stacks(self):
        msg = base_msg("state_sync", {
            "active_stack_id": "stack-1",
            "cards": [],
            "chat_history": [],
        })
        assert is_state_sync(msg) is False

    def test_missing_active_stack_id(self):
        msg = base_msg("state_sync", {
            "stacks": [],
            "cards": [],
            "chat_history": [],
        })
        assert is_state_sync(msg) is False

    def test_is_protocol_message(self):
        msg = base_msg("state_sync", self.valid_payload)
        assert is_protocol_message(msg) is True

    def test_parse_message(self):
        msg = base_msg("state_sync", self.valid_payload)
        result = parse_message(json.dumps(msg))
        assert result is not None
        assert result["type"] == "state_sync"


class TestCanvasInteractionExpanded:
    """canvas_interaction validates new archive/create/restore actions."""

    original_actions = ["edit_cell", "resize", "move", "close"]
    new_actions = ["archive_card", "archive_stack", "create_stack", "restore_stack"]

    @pytest.mark.parametrize("action", original_actions + new_actions)
    def test_valid_action(self, action):
        msg = base_msg("canvas_interaction", {
            "card_id": "card-1",
            "action": action,
            "data": {},
        })
        assert is_canvas_interaction(msg) is True

    def test_invalid_action(self):
        msg = base_msg("canvas_interaction", {
            "card_id": "card-1",
            "action": "delete_everything",
            "data": {},
        })
        assert is_canvas_interaction(msg) is False


class TestCanvasUpdateStackId:
    """is_canvas_update handles optional stack_id."""

    def test_without_stack_id(self):
        msg = base_msg("canvas_update", {
            "command": "create_card",
            "card_id": "card-1",
        })
        assert is_canvas_update(msg) is True

    def test_with_stack_id(self):
        msg = base_msg("canvas_update", {
            "command": "create_card",
            "card_id": "card-1",
            "stack_id": "stack-abc",
        })
        assert is_canvas_update(msg) is True


class TestMissionMessageContext:
    """is_mission_message handles optional context."""

    def test_without_context(self):
        msg = base_msg("mission", {"text": "Hello"})
        assert is_mission_message(msg) is True

    def test_with_context(self):
        msg = base_msg("mission", {
            "text": "Hello",
            "context": {"stack_id": "stack-abc"},
        })
        assert is_mission_message(msg) is True
