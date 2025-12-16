"""
Anthropic SDK extraction service for structured data extraction from documents.

Uses Claude's tool use feature for guaranteed structured outputs.
"""

from typing import Any, TypedDict
from anthropic import AsyncAnthropic
from anthropic.types import Message

from ..config import get_settings

# Lazy client initialization to avoid import-time errors
_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    """Get or create the Anthropic client (lazy initialization)."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


# Tool definition for structured extraction output
EXTRACTION_TOOL = {
    "name": "save_extracted_data",
    "description": "Save the extracted structured data from the document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "extracted_fields": {
                "type": "object",
                "description": "Field names to extracted values (snake_case).",
                "additionalProperties": True
            },
            "confidence_scores": {
                "type": "object",
                "description": "Field names to confidence scores (0.0-1.0).",
                "additionalProperties": {"type": "number", "minimum": 0.0, "maximum": 1.0}
            }
        },
        "required": ["extracted_fields", "confidence_scores"]
    }
}

# Extraction prompts
AUTO_PROMPT = """Analyze this document and extract ALL relevant structured data.

Use clear, descriptive field names in snake_case (e.g., vendor_name, invoice_date, total_amount).
For each field, provide a confidence score between 0.0 and 1.0.

Guidelines:
- Extract dates in ISO 8601 format (YYYY-MM-DD)
- Extract monetary amounts as numbers (without currency symbols)
- Only extract data that is explicitly present in the document
- If a field value is unclear or missing, omit it rather than guessing
- Common fields to look for: vendor/company names, dates, amounts, IDs, addresses, line items

Document text:
{text}"""

CUSTOM_PROMPT = """Extract ONLY these specific fields from the document: {fields}

For each field, provide a confidence score between 0.0 and 1.0.

Guidelines:
- Extract dates in ISO 8601 format (YYYY-MM-DD)
- Extract monetary amounts as numbers (without currency symbols)
- If a requested field is not found, set its value to null with confidence 0.0
- Only extract data that is explicitly present in the document
- Do not invent or infer values that aren't clearly stated

Document text:
{text}"""


class ExtractionResult(TypedDict):
    """Structured extraction result from Claude."""
    extracted_fields: dict[str, Any]
    confidence_scores: dict[str, float]


def _parse_tool_response(response: Message) -> ExtractionResult:
    """Extract tool use result from Claude response."""
    for block in response.content:
        if block.type == "tool_use" and block.name == "save_extracted_data":
            return {
                "extracted_fields": block.input.get("extracted_fields", {}),
                "confidence_scores": block.input.get("confidence_scores", {})
            }
    raise ValueError("No extraction result returned from Claude")


async def _call_extraction(prompt: str) -> ExtractionResult:
    """Make extraction API call with the given prompt."""
    settings = get_settings()
    client = _get_client()

    response = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        tools=[EXTRACTION_TOOL],
        tool_choice={"type": "tool", "name": "save_extracted_data"},
        messages=[{"role": "user", "content": prompt}]
    )
    return _parse_tool_response(response)


async def extract_auto_mode(text: str) -> ExtractionResult:
    """
    Extract all relevant fields automatically from document text.

    Args:
        text: Raw text from OCR extraction

    Returns:
        ExtractionResult with extracted_fields and confidence_scores
    """
    return await _call_extraction(AUTO_PROMPT.format(text=text))


async def extract_custom_fields(text: str, custom_fields: list[str]) -> ExtractionResult:
    """
    Extract only specified fields from document text.

    Args:
        text: Raw text from OCR extraction
        custom_fields: List of field names to extract

    Returns:
        ExtractionResult with extracted_fields and confidence_scores
    """
    fields_str = ", ".join(custom_fields)
    return await _call_extraction(CUSTOM_PROMPT.format(fields=fields_str, text=text))
