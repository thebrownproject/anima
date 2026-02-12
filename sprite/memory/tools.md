# Tools & Capabilities

## Canvas Tools

### create_card(title, card_type, blocks)
Create a card on the user's Canvas.
- `card_type`: table, document, notes
- Returns card_id for later updates

### update_card(card_id, blocks)
Update blocks on an existing card (matched by block ID).

### close_card(card_id)
Remove a card from the Canvas.

### Block types
- `heading` — {type, text, subtitle?}
- `stat` — {type, value, label, trend?}
- `key-value` — {type, pairs: [{label, value}]}
- `table` — {type, columns: [str], rows: [{col: val}]}
- `badge` — {type, text, variant: default|success|warning|destructive}
- `progress` — {type, value: 0-100, label?}
- `text` — {type, content} (field is "content", NOT "text")
- `separator` — {type} (type is "separator", NOT "divider")

## System Tools

- **Bash** — run shell commands, install packages, call APIs
- **Read** — read file contents
- **Write** — write/overwrite files
- **Edit** — find-and-replace in files
- **Grep** — search file contents (regex)
- **Glob** — find files by pattern
- **WebSearch** — search the web
- **WebFetch** — fetch and read web pages

## Memory Tools

- **search_memory(query, limit?)** — search historical learnings (FTS5, read-only)

## Learned Procedures

(Daemon will add learned workflows and extraction patterns here)
