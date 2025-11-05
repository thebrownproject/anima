"""Document extraction service using LangChain + LLM for structured data extraction."""

import logging
from typing import TypedDict

logger = logging.getLogger(__name__)


class ExtractionResult(TypedDict):
    """Result from LLM-based structured data extraction."""

    extracted_fields: dict[str, any]  # Structured data extracted by LLM
    confidence_scores: dict[str, float] | None  # Per-field confidence (0.0-1.0)
    status: str  # 'success', 'partial', 'failure'
    errors: list[str]


# TODO: Implement LangChain extraction functions (Day 6-7 tasks)
#
# These functions will be implemented after OCR integration is complete.
# They will use LangChain + OpenRouter (Claude) to extract structured data
# from the raw OCR text.
#
# Planned functions:
# - async def extract_fields_auto(raw_text: str) -> ExtractionResult
#   Uses LangChain to automatically detect and extract all relevant fields
#
# - async def extract_fields_custom(raw_text: str, custom_fields: list[str]) -> ExtractionResult
#   Extracts only the user-specified fields from the document
#
# - def calculate_confidence_scores(extracted_data: dict) -> dict[str, float]
#   Calculates confidence scores for each extracted field (optional)
#
# Architecture:
# 1. Input: raw_text (markdown from OCR service)
# 2. Build LangChain prompt based on mode (auto vs custom)
# 3. Call OpenRouter API (Claude 3.5 Sonnet) via LangChain
# 4. Use with_structured_output() for type-safe extraction
# 5. Return structured fields as JSONB-compatible dict
#
# See planning/ARCHITECTURE.md for detailed extraction flow
