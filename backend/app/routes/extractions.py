"""Extraction result endpoints"""

from typing import Any
from fastapi import APIRouter, HTTPException, Form
from ..services.extractor import extract_auto_mode, extract_custom_fields

router = APIRouter()


@router.post("/test-extract-auto")
async def test_extract_auto(text: str = Form(...)) -> dict[str, Any]:  # pyright: ignore[reportCallInDefaultInitializer]
    """
    **TEST ENDPOINT** - Test auto extraction mode with sample text.

    This endpoint tests the LangChain extraction service in auto mode,
    where the AI automatically detects and extracts all relevant fields.

    Args:
        text: Sample document text to extract data from

    Returns:
        Extraction result with extracted_fields and confidence_scores
    """
    try:
        result = await extract_auto_mode(text)
        return {
            "mode": "auto",
            "extracted_fields": result["extracted_fields"],
            "confidence_scores": result["confidence_scores"],
            "field_count": len(result["extracted_fields"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/test-extract-custom")
async def test_extract_custom(
    text: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    custom_fields: str = Form(...)  # pyright: ignore[reportCallInDefaultInitializer]
) -> dict[str, Any]:
    """
    **TEST ENDPOINT** - Test custom extraction mode with sample text.

    This endpoint tests the LangChain extraction service in custom mode,
    where only user-specified fields are extracted.

    Args:
        text: Sample document text to extract data from
        custom_fields: Comma-separated list of field names (e.g., "vendor_name,total_amount,invoice_date")

    Returns:
        Extraction result with extracted_fields and confidence_scores
    """
    try:
        # Parse comma-separated field names
        fields_list = [field.strip() for field in custom_fields.split(",")]

        result = await extract_custom_fields(text, fields_list)
        return {
            "mode": "custom",
            "requested_fields": fields_list,
            "extracted_fields": result["extracted_fields"],
            "confidence_scores": result["confidence_scores"],
            "field_count": len(result["extracted_fields"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


# TODO: Implement production extraction endpoints
# - GET /extractions/{extraction_id} - Get extraction results
# - GET /extractions/{extraction_id}/status - Poll extraction status
# - POST /extractions/{extraction_id}/re-extract - Re-extract document
# - PUT /extractions/{extraction_id} - Update extraction fields (manual edit)
# - GET /extractions/{extraction_id}/export - Export to CSV/JSON
