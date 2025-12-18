"""
Agent SDK extraction service for structured data extraction from documents.

Runs alongside existing extractor.py - does not replace it.
Uses Claude Agent SDK for session persistence and streaming.

Key features:
- Session-based extraction with memory
- Streaming events (thinking, complete, error)
- Session resume for user corrections
"""

import json
from typing import Any, AsyncIterator

from claude_agent_sdk import (
    tool,
    create_sdk_mcp_server,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ResultMessage,
)

from ..config import get_settings

# Import prompts from existing extractor (reuse proven prompts)
from .extractor import AUTO_PROMPT, CUSTOM_PROMPT


# --- Tool Definition ---

@tool(
    "save_extracted_data",
    "Save the extracted structured data from the document. Call this with the extracted fields and confidence scores.",
    {"extracted_fields": dict, "confidence_scores": dict}
)
async def extraction_tool(args: dict) -> dict:
    """
    Tool handler - acknowledges receipt.

    Actual data is captured from ToolUseBlock.input in the extraction loop.
    This handler just returns success so the agent knows the save worked.
    """
    return {
        "content": [{"type": "text", "text": "Extraction saved successfully"}]
    }


# Create MCP server singleton
# Server is reused across all extraction calls
_extraction_server = create_sdk_mcp_server(
    name="extraction",
    tools=[extraction_tool]
)


# --- Streaming Event Types ---
# Events yielded by extract_with_agent and correct_with_session:
#
# {"type": "thinking", "text": "..."}
#   - Claude's reasoning as it analyzes the document
#   - Yielded in real-time as thinking happens
#
# {"type": "complete", "extraction": {...}, "session_id": "...", "thinking": "..."}
#   - Final extraction result
#   - extraction: {"extracted_fields": {...}, "confidence_scores": {...}}
#   - session_id: UUID to resume this session later
#   - thinking: Full reasoning concatenated
#
# {"type": "error", "message": "..."}
#   - Error occurred during extraction


def _parse_extraction_input(tool_input: dict) -> dict:
    """
    Parse tool input, handling JSON string edge case.

    The SDK sometimes passes extracted_fields/confidence_scores as JSON strings
    instead of dicts. This normalizes the input.
    """
    result = {}

    for key in ["extracted_fields", "confidence_scores"]:
        value = tool_input.get(key, {})
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = {}
        result[key] = value

    return result


async def extract_with_agent(
    ocr_text: str,
    mode: str,
    custom_fields: list[str] | None = None
) -> AsyncIterator[dict[str, Any]]:
    """
    Extract data using Agent SDK with streaming.

    Args:
        ocr_text: Raw text from OCR extraction
        mode: "auto" for automatic extraction, "custom" for specific fields
        custom_fields: List of field names (required if mode="custom")

    Yields:
        {"type": "thinking", "text": "..."} - Real-time reasoning
        {"type": "complete", "extraction": {...}, "session_id": "...", "thinking": "..."}
        {"type": "error", "message": "..."}

    Example:
        async for event in extract_with_agent(ocr_text, "auto"):
            if event["type"] == "thinking":
                print(f"Claude: {event['text']}")
            elif event["type"] == "complete":
                save_to_db(event["extraction"], event["session_id"])
    """
    settings = get_settings()

    # Build prompt using existing prompts
    if mode == "auto":
        prompt = AUTO_PROMPT.format(text=ocr_text)
    else:
        fields_str = ", ".join(custom_fields or [])
        prompt = CUSTOM_PROMPT.format(fields=fields_str, text=ocr_text)

    # Add extraction instruction to ensure tool is called
    prompt += "\n\nAfter analyzing the document, call the save_extracted_data tool with your extracted fields and confidence scores."

    options = ClaudeAgentOptions(
        mcp_servers={"extraction": _extraction_server},
        allowed_tools=["mcp__extraction__save_extracted_data"],
        max_turns=3,  # Enough for: think -> extract -> confirm
    )

    thinking_chunks: list[str] = []
    extraction_result: dict | None = None
    session_id: str | None = None

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)

            async for message in client.receive_response():
                # Capture session_id from ResultMessage
                if isinstance(message, ResultMessage):
                    session_id = message.session_id

                elif isinstance(message, AssistantMessage):
                    for block in message.content:
                        # Stream thinking text
                        if isinstance(block, TextBlock):
                            thinking_chunks.append(block.text)
                            yield {"type": "thinking", "text": block.text}

                        # Capture extraction from tool call
                        elif isinstance(block, ToolUseBlock):
                            if block.name == "mcp__extraction__save_extracted_data":
                                extraction_result = _parse_extraction_input(block.input)

        # Yield completion event
        if extraction_result:
            yield {
                "type": "complete",
                "extraction": extraction_result,
                "session_id": session_id,  # May be None - route handler should handle gracefully
                "thinking": "\n".join(thinking_chunks),
                "corrections_enabled": session_id is not None,  # Flag for frontend
            }
        else:
            yield {
                "type": "error",
                "message": "No extraction result - Claude did not call save_extracted_data tool"
            }

    except Exception as e:
        yield {"type": "error", "message": str(e)}


async def correct_with_session(
    session_id: str,
    instruction: str
) -> AsyncIterator[dict[str, Any]]:
    """
    Resume session for correction based on user feedback.

    This continues the previous conversation, so Claude remembers:
    - The original document content
    - What it previously extracted
    - Any previous corrections

    Args:
        session_id: Session ID from previous extraction
        instruction: User's correction instruction (e.g., "The vendor name should be 'Acme Inc'")

    Yields:
        Same event types as extract_with_agent

    Example:
        # User says the total was wrong
        async for event in correct_with_session(
            session_id="abc-123",
            instruction="The total amount should be $1,500, not $1,320"
        ):
            if event["type"] == "complete":
                update_extraction(event["extraction"])
    """
    options = ClaudeAgentOptions(
        resume=session_id,  # Resume previous conversation
        mcp_servers={"extraction": _extraction_server},
        allowed_tools=["mcp__extraction__save_extracted_data"],
        max_turns=3,
    )

    thinking_chunks: list[str] = []
    extraction_result: dict | None = None

    # Build correction prompt
    prompt = f"""The user has provided a correction to the extraction:

{instruction}

Please update the extraction accordingly and call save_extracted_data with the corrected fields and confidence scores."""

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            thinking_chunks.append(block.text)
                            yield {"type": "thinking", "text": block.text}

                        elif isinstance(block, ToolUseBlock):
                            if block.name == "mcp__extraction__save_extracted_data":
                                extraction_result = _parse_extraction_input(block.input)

        if extraction_result:
            yield {
                "type": "complete",
                "extraction": extraction_result,
                "session_id": session_id,  # Same session continues
                "thinking": "\n".join(thinking_chunks)
            }
        else:
            yield {
                "type": "error",
                "message": "No extraction result from correction"
            }

    except Exception as e:
        yield {"type": "error", "message": str(e)}
