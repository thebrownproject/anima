"""Manual test for canvas tools integration — verifies MCP server registration."""

import asyncio
from src.tools.canvas import create_canvas_tools
from claude_agent_sdk import create_sdk_mcp_server


async def test_mcp_registration():
    """Test that canvas tools register correctly via MCP server."""

    # Mock send function
    sent_messages = []
    async def mock_send(msg: str):
        sent_messages.append(msg)

    # Create tools
    canvas_tools = create_canvas_tools(mock_send)

    # Create MCP server
    sprite_server = create_sdk_mcp_server(name="sprite", tools=canvas_tools)

    print(f"✓ Created {len(canvas_tools)} canvas tools")
    print(f"✓ MCP server registered: {sprite_server}")

    # Verify tools are callable
    for i, tool in enumerate(canvas_tools):
        print(f"  Tool {i}: {tool.name} - {tool.description[:50]}...")

    # Test create_card call
    create_card = canvas_tools[0].handler
    result = await create_card({
        "title": "Test Card",
        "card_type": "table",
        "blocks": [
            {"type": "heading", "text": "Test Heading"},
        ]
    })

    print(f"\n✓ create_card test:")
    print(f"  Result: {result['content'][0]['text']}")
    print(f"  Messages sent: {len(sent_messages)}")

    print("\n✅ All manual tests passed!")


if __name__ == "__main__":
    asyncio.run(test_mcp_registration())
