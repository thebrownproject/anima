"""Extraction result endpoints"""

import time
import logging
from typing import Any
from fastapi import APIRouter, HTTPException, Form
from ..services.extractor import extract_auto_mode, extract_custom_fields
from ..config import get_settings
from ..database import get_supabase_client

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


@router.post("/test-extract-auto")
async def test_extract_auto(
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...)  # pyright: ignore[reportCallInDefaultInitializer]
) -> dict[str, Any]:
    """
    **TEST ENDPOINT** - Test auto extraction mode with cached OCR text.

    This endpoint fetches OCR text from the ocr_results table and runs
    auto extraction. Tests the re-extraction flow using cached OCR.

    Args:
        document_id: Document UUID to extract from (must have OCR result)
        user_id: User UUID (for RLS and saving extraction)

    Returns:
        Extraction result with extracted_fields, confidence_scores, model, and processing_time_ms
    """
    try:
        # Fetch OCR text from database
        supabase = get_supabase_client()
        ocr_response = supabase.table("ocr_results").select("raw_text").eq("document_id", document_id).single().execute()

        if not ocr_response.data:
            raise HTTPException(status_code=404, detail=f"No OCR result found for document_id={document_id}")

        text = ocr_response.data["raw_text"]
        logger.info(f"Fetched cached OCR text: document_id={document_id}, length={len(text)}")

        # Start timing
        start_time = time.time()

        # Run extraction
        result = await extract_auto_mode(text)

        # Calculate processing time (in milliseconds)
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Get model name from settings
        model = settings.OPENROUTER_MODEL

        # Save extraction to database
        try:
            supabase.table("extractions").insert({
                "document_id": document_id,
                "user_id": user_id,
                "extracted_fields": result["extracted_fields"],
                "confidence_scores": result["confidence_scores"],
                "mode": "auto",
                "custom_fields": None,
                "model": model,
                "processing_time_ms": processing_time_ms
            }).execute()
            logger.info(f"Saved auto extraction to database: document_id={document_id}, model={model}, time={processing_time_ms}ms")
        except Exception as db_error:
            logger.error(f"Failed to save extraction to database: {db_error}")
            # Don't fail the request - still return extraction result

        return {
            "mode": "auto",
            "extracted_fields": result["extracted_fields"],
            "confidence_scores": result["confidence_scores"],
            "model": model,
            "processing_time_ms": processing_time_ms,
            "field_count": len(result["extracted_fields"])
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/test-extract-custom")
async def test_extract_custom(
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    custom_fields: str = Form(...)  # pyright: ignore[reportCallInDefaultInitializer]
) -> dict[str, Any]:
    """
    **TEST ENDPOINT** - Test custom extraction mode with cached OCR text.

    This endpoint fetches OCR text from the ocr_results table and runs
    custom extraction with user-specified fields. Tests re-extraction flow.

    Args:
        document_id: Document UUID to extract from (must have OCR result)
        user_id: User UUID (for RLS and saving extraction)
        custom_fields: Comma-separated list of field names (e.g., "vendor_name,total_amount,invoice_date")

    Returns:
        Extraction result with extracted_fields, confidence_scores, model, and processing_time_ms
    """
    try:
        # Parse comma-separated field names
        fields_list = [field.strip() for field in custom_fields.split(",")]

        # Fetch OCR text from database
        supabase = get_supabase_client()
        ocr_response = supabase.table("ocr_results").select("raw_text").eq("document_id", document_id).single().execute()

        if not ocr_response.data:
            raise HTTPException(status_code=404, detail=f"No OCR result found for document_id={document_id}")

        text = ocr_response.data["raw_text"]
        logger.info(f"Fetched cached OCR text: document_id={document_id}, length={len(text)}")

        # Start timing
        start_time = time.time()

        # Run extraction
        result = await extract_custom_fields(text, fields_list)

        # Calculate processing time (in milliseconds)
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Get model name from settings
        model = settings.OPENROUTER_MODEL

        # Save extraction to database
        try:
            supabase.table("extractions").insert({
                "document_id": document_id,
                "user_id": user_id,
                "extracted_fields": result["extracted_fields"],
                "confidence_scores": result["confidence_scores"],
                "mode": "custom",
                "custom_fields": fields_list,
                "model": model,
                "processing_time_ms": processing_time_ms
            }).execute()
            logger.info(f"Saved custom extraction to database: document_id={document_id}, model={model}, time={processing_time_ms}ms")
        except Exception as db_error:
            logger.error(f"Failed to save extraction to database: {db_error}")
            # Don't fail the request - still return extraction result

        return {
            "mode": "custom",
            "requested_fields": fields_list,
            "extracted_fields": result["extracted_fields"],
            "confidence_scores": result["confidence_scores"],
            "model": model,
            "processing_time_ms": processing_time_ms,
            "field_count": len(result["extracted_fields"])
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


# TODO: Implement production extraction endpoints
# - GET /extractions/{extraction_id} - Get extraction results
# - GET /extractions/{extraction_id}/status - Poll extraction status
# - POST /extractions/{extraction_id}/re-extract - Re-extract document
# - PUT /extractions/{extraction_id} - Update extraction fields (manual edit)
# - GET /extractions/{extraction_id}/export - Export to CSV/JSON
