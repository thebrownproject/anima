"""
Tool: update_field (WRITE)

Updates a specific field using JSON path notation.
Uses Postgres jsonb_set() for surgical updates.

Examples:
- path="document.title" → updates nested field
- path="items[2].price" → updates array item
"""
