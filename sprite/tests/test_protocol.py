"""Tests for protocol type guards — state_sync, expanded canvas actions, optional fields."""

import json
import pytest

from src.protocol import (
    MESSAGE_TYPES,
    _snake_to_camel,
    is_canvas_interaction,
    is_canvas_update,
    is_mission_message,
    is_protocol_message,
    is_state_sync,
    parse_message,
    to_dict,
    AgentEvent,
    AgentEventPayload,
    AgentEventMeta,
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

    def test_context_not_dict_rejected(self):
        msg = base_msg("mission", {"text": "Hello", "context": "bad"})
        assert is_mission_message(msg) is False

    def test_context_missing_stack_id_rejected(self):
        msg = base_msg("mission", {"text": "Hello", "context": {}})
        assert is_mission_message(msg) is False

    def test_context_stack_id_not_string_rejected(self):
        msg = base_msg("mission", {"text": "Hello", "context": {"stack_id": 123}})
        assert is_mission_message(msg) is False

    def test_context_null_accepted(self):
        """context: null (None) is valid -- treated as absent."""
        msg = base_msg("mission", {"text": "Hello", "context": None})
        assert is_mission_message(msg) is True


class TestMessageTypesRegistry:
    """MESSAGE_TYPES includes all control and protocol message types."""

    @pytest.mark.parametrize("mtype", ["ping", "pong", "heartbeat", "state_sync_request"])
    def test_control_types_registered(self, mtype):
        assert mtype in MESSAGE_TYPES


class TestSnakeToCamel:
    """_snake_to_camel converts field names correctly."""

    def test_basic(self):
        assert _snake_to_camel("extraction_id") == "extractionId"

    def test_two_underscores(self):
        assert _snake_to_camel("session_id") == "sessionId"

    def test_no_underscore(self):
        assert _snake_to_camel("name") == "name"

    def test_multiple_parts(self):
        assert _snake_to_camel("my_long_field_name") == "myLongFieldName"


class TestAgentEventMetaSerialization:
    """AgentEventMeta camelCase conversion handles all fields systematically."""

    def test_both_fields(self):
        event = AgentEvent(
            type="agent_event",
            payload=AgentEventPayload(
                event_type="text",
                content="hello",
                meta=AgentEventMeta(extraction_id="e1", session_id="s1"),
            ),
        )
        d = to_dict(event)
        meta = d["payload"]["meta"]
        assert "extractionId" in meta
        assert "sessionId" in meta
        assert "extraction_id" not in meta
        assert "session_id" not in meta

    def test_one_field_none(self):
        event = AgentEvent(
            type="agent_event",
            payload=AgentEventPayload(
                event_type="text",
                content="hello",
                meta=AgentEventMeta(extraction_id="e1", session_id=None),
            ),
        )
        d = to_dict(event)
        meta = d["payload"]["meta"]
        assert meta == {"extractionId": "e1"}

    def test_all_none_meta_removed(self):
        event = AgentEvent(
            type="agent_event",
            payload=AgentEventPayload(
                event_type="text",
                content="hello",
                meta=AgentEventMeta(extraction_id=None, session_id=None),
            ),
        )
        d = to_dict(event)
        assert "meta" not in d["payload"]
