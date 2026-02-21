"""Extraction tools -- structured data extraction from uploaded documents."""

from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable, TYPE_CHECKING

from claude_agent_sdk import tool

from ..protocol import (
    CanvasUpdate,
    CanvasUpdatePayload,
    HeadingBlock,
    KeyValueBlock,
    KeyValuePair,
    TableBlock,
    BadgeBlock,
    _new_id,
    to_json,
)

if TYPE_CHECKING:
    from ..database import WorkspaceDB

logger = logging.getLogger(__name__)

SendFn = Callable[[str], Awaitable[None]]

TABLE_COLUMNS = ["Description", "Quantity", "Unit Price", "Total"]


def _parse_json_param(value: Any) -> Any:
    """Parse JSON if value is a stringified JSON object/array."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            pass
    return value


def _error_result(message: str) -> dict:
    return {"content": [{"type": "text", "text": message}], "is_error": True}


def _format_currency(value: Any) -> str:
    """Format a numeric value as currency string."""
    try:
        return f"${float(value):,.2f}"
    except (ValueError, TypeError):
        return str(value)


def _build_row(item: dict) -> dict[str, Any]:
    return {
        "Description": str(item.get("description", "")),
        "Quantity": str(item.get("quantity", "")),
        "Unit Price": _format_currency(item.get("unit_price", "")),
        "Total": _format_currency(item.get("total", "")),
    }


def create_extraction_tools(
    send_fn: SendFn,
    workspace_db: WorkspaceDB | None = None,
    stack_id_fn: Callable[[], str | None] | None = None,
) -> list:
    """Create extraction tools scoped with WebSocket send function and optional DB persistence."""

    @tool(
        "extract_invoice",
        "Create a table card from extracted invoice data. Call this after reading a PDF "
        "and extracting structured fields.\n\n"
        "Parameters:\n"
        "- file_path (str): Path to the source PDF file.\n"
        "- vendor (str): Vendor/company name from the invoice.\n"
        "- date (str, optional): Invoice date.\n"
        "- invoice_number (str, optional): Invoice number/reference.\n"
        "- line_items (list[dict]): Array of line items, each with: "
        "description (str), quantity (number), unit_price (number), total (number).\n"
        "- subtotal (number, optional): Subtotal before tax.\n"
        "- tax (number, optional): Tax amount.\n"
        "- grand_total (number, optional): Grand total including tax.\n",
        {"file_path": str, "vendor": str, "line_items": list},
    )
    async def extract_invoice(_args: dict) -> dict:
        file_path = (_args.get("file_path") or "").strip()
        vendor = (_args.get("vendor") or "").strip()

        if not file_path:
            return _error_result("file_path is required")
        if not vendor:
            return _error_result("vendor is required")

        line_items = _parse_json_param(_args.get("line_items", []))
        if not isinstance(line_items, list) or len(line_items) == 0:
            return _error_result("line_items must be a non-empty list")

        date = _args.get("date")
        invoice_number = _args.get("invoice_number")
        subtotal = _args.get("subtotal")
        tax = _args.get("tax")
        grand_total = _args.get("grand_total")

        # Build key-value pairs for invoice metadata
        kv_pairs = [KeyValuePair(label="Vendor", value=vendor)]
        if date:
            kv_pairs.append(KeyValuePair(label="Date", value=str(date)))
        if invoice_number:
            kv_pairs.append(KeyValuePair(label="Invoice #", value=str(invoice_number)))
        if subtotal is not None:
            kv_pairs.append(KeyValuePair(label="Subtotal", value=_format_currency(subtotal)))
        if tax is not None:
            kv_pairs.append(KeyValuePair(label="Tax", value=_format_currency(tax)))
        if grand_total is not None:
            kv_pairs.append(KeyValuePair(label="Grand Total", value=_format_currency(grand_total)))

        # Build table rows
        rows = [_build_row(item) for item in line_items]

        # Build preview_rows for the card face (list of lists)
        preview_rows = [
            [r["Description"], r["Quantity"], r["Unit Price"], r["Total"]]
            for r in rows
        ]

        # Assemble blocks
        blocks = [
            HeadingBlock(id=_new_id(), type="heading", text=f"Invoice: {vendor}", subtitle=date),
            KeyValueBlock(id=_new_id(), type="key-value", pairs=kv_pairs),
            TableBlock(id=_new_id(), type="table", columns=TABLE_COLUMNS, rows=rows),
            BadgeBlock(id=_new_id(), type="badge", text="Extracted", variant="success"),
        ]

        title = f"Invoice - {vendor}"
        card_id = _new_id()
        summary = f"{len(line_items)} line items"
        if grand_total is not None:
            summary += f" | {_format_currency(grand_total)}"

        message = CanvasUpdate(
            type="canvas_update",
            payload=CanvasUpdatePayload(
                command="create_card",
                card_id=card_id,
                title=title,
                blocks=blocks,
                size="large",
                card_type="table",
                summary=summary,
                tags=["invoice", vendor.lower()],
                headers=TABLE_COLUMNS,
                preview_rows=preview_rows,
                stack_id=stack_id_fn() if stack_id_fn else None,
            ),
        )

        try:
            await send_fn(to_json(message))
        except Exception as e:
            logger.error("Failed to send canvas_update for extract_invoice: %s", e)
            return _error_result(f"WebSocket error: {e}")

        # Persist to DB
        current_stack_id = stack_id_fn() if stack_id_fn else None
        if workspace_db and current_stack_id:
            # Convert block dataclasses to dicts for DB storage
            blocks_dicts = [
                {"type": "heading", "text": f"Invoice: {vendor}", "subtitle": date},
                {"type": "key-value", "pairs": [{"label": p.label, "value": p.value} for p in kv_pairs]},
                {"type": "table", "columns": TABLE_COLUMNS, "rows": rows},
                {"type": "badge", "text": "Extracted", "variant": "success"},
            ]
            await workspace_db.upsert_card(
                card_id, current_stack_id, title, blocks_dicts, "large",
                card_type="table", summary=summary, tags=["invoice", vendor.lower()],
                headers=TABLE_COLUMNS, preview_rows=preview_rows,
            )

        logger.info("Created invoice card %s: %s (%d items)", card_id, vendor, len(line_items))
        return {"content": [{"type": "text", "text": f"Card created: {title} (ID: {card_id})"}]}

    return [extract_invoice]
