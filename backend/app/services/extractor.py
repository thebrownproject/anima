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
AUTO_PROMPT = """You are an expert data extraction system. Analyze this document and extract ALL relevant structured data into a rich, well-organized schema.

## CRITICAL: Output Structure Requirements

You MUST use rich, nested structures with arrays and objects. NEVER create flat numbered fields.

❌ BAD (flat numbered fields - DO NOT DO THIS):
{{
  "project_1": "Shelter Sync",
  "project_2": "Smart Home System",
  "experience_1": "Company A",
  "experience_1_role": "Developer",
  "experience_2": "Company B"
}}

✅ GOOD (rich nested structures - DO THIS):
{{
  "projects": [
    {{
      "project_name": "Shelter Sync",
      "description": "Animal shelter management system with RFID integration",
      "technologies": ["SvelteKit", "TypeScript", "Supabase"],
      "key_achievements": ["Full-stack development", "RFID scanning integration"]
    }}
  ],
  "work_experience": [
    {{
      "company": "Company A",
      "job_title": "Developer",
      "start_year": 2020,
      "end_year": 2023,
      "location": "Melbourne",
      "key_responsibilities": ["Led development", "Managed team"]
    }}
  ]
}}

## Schema Design Rules

1. **Use Arrays for Collections**: Group similar items into arrays (projects[], work_experience[], education[], line_items[], skills[])

2. **Use Objects for Complex Items**: Each array item should be an object with multiple descriptive properties

3. **Include Rich Context**: For each item, extract:
   - Names/titles (project_name, job_title, company)
   - Descriptions (what it is, what it does)
   - Dates (start_year, end_year, date)
   - Locations (city, country, address)
   - Details (technologies, responsibilities, achievements, amounts)

4. **Descriptive Field Names**: Use clear names like "job_title" not "title1", "company_name" not "exp1"

5. **Appropriate Data Types**:
   - Dates: ISO 8601 (YYYY-MM-DD) or separate year fields (start_year: 2020)
   - Numbers: Use numeric types, not strings
   - Lists: Use arrays for multiple values (technologies, skills, achievements)
   - Amounts: Numbers without currency symbols

## Document Type Examples

**Resume/CV Structure**:
- full_name, email, phone, location, professional_summary
- work_experience[] (company, job_title, start_year, end_year, location, key_responsibilities[])
- education[] (institution, qualification, start_year, end_year, location)
- projects[] (project_name, description, technologies[], key_achievements[])
- skills (programming_languages[], frameworks[], tools[])

**Invoice Structure**:
- vendor (name, address, phone, email, tax_id)
- customer (name, address)
- invoice_number, invoice_date, due_date
- line_items[] (description, quantity, unit_price, total)
- subtotal, tax_amount, total_amount

**Contract Structure**:
- parties[] (name, role, address)
- effective_date, expiration_date
- terms[] (title, description)
- signatures[] (name, title, date)

## Quality Standards

- Extract ALL relevant information, not just basics
- Include descriptions and context, not just names
- Capture achievements, responsibilities, and details
- Only extract data explicitly present in the document
- Omit fields if value is unclear or missing (don't guess)

Provide confidence scores (0.0-1.0) for each top-level field.

Document text:
{text}"""

CUSTOM_PROMPT = """You are an expert data extraction system. Extract the following specific fields from the document: {fields}

## CRITICAL: Output Structure Requirements

Even when extracting specific fields, use rich nested structures where appropriate.

❌ BAD (flat structure):
{{
  "project_1": "Name",
  "project_1_tech": "Python"
}}

✅ GOOD (nested structure):
{{
  "projects": [
    {{
      "project_name": "Name",
      "technologies": ["Python"]
    }}
  ]
}}

## Guidelines

1. **Interpret field requests intelligently**:
   - "projects" → Extract as array of project objects with full details
   - "work_experience" → Extract as array of experience objects
   - "line_items" → Extract as array with description, quantity, price, total

2. **Include rich details** for each item: names, descriptions, dates, locations, and specifics

3. **Use appropriate types**:
   - Dates: ISO 8601 format (YYYY-MM-DD) or year integers
   - Amounts: Numbers without currency symbols
   - Lists: Arrays for multiple values

4. **Only extract requested fields** but make them comprehensive

5. **If a field is not found**: Set to null with confidence 0.0

Provide confidence scores (0.0-1.0) for each extracted field.

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
