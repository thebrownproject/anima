"""Test configuration — mock claude_agent_sdk for local testing.

The real SDK is only available on Sprite VMs. This provides lightweight
stubs so tool unit tests (canvas, memory) can run locally. Integration
tests that need ClaudeSDKClient still require the real SDK on a Sprite.
"""

import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

# Only install the mock if the real SDK isn't available
try:
    import claude_agent_sdk  # noqa: F401
except ImportError:
    class _ToolWrapper:
        """Mimics the SDK's tool decorator — wraps async fn with .handler attribute."""
        def __init__(self, name: str, description: str, params: dict):
            self.name = name
            self.description = description
            self.params = params
            self.handler = None

        def __call__(self, fn):
            self.handler = fn
            return self

    def _tool(name: str, description: str, params: dict):
        return _ToolWrapper(name, description, params)

    # Build mock module with the symbols production code imports
    mock_sdk = SimpleNamespace(
        tool=_tool,
        # Stubs for imports that aren't exercised in tool unit tests
        ClaudeSDKClient=MagicMock,
        ClaudeAgentOptions=MagicMock,
        HookMatcher=MagicMock,
        AssistantMessage=MagicMock,
        TextBlock=MagicMock,
        ToolUseBlock=MagicMock,
        ResultMessage=MagicMock,
        create_sdk_mcp_server=MagicMock,
    )
    sys.modules["claude_agent_sdk"] = mock_sdk
