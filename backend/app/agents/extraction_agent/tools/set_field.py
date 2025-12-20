"""
Tool: set_field (WRITE)

Sets a specific field using JSON path notation.
Uses Postgres jsonb_set() for surgical updates.

Examples:
- path="document.title" → sets nested field
- path="items[2].price" → sets array item
"""
