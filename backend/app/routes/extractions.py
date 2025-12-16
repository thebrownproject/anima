"""Test extraction endpoints for validating OCR → extraction pipeline."""

import logging
import time
from typing import Annotated, Any

from fastapi import APIRouter, Form, HTTPException
from pydantic import BaseModel

from ..config import get_settings
from ..database import get_supabase_client
from ..services.extractor import ExtractionResult, extract_auto_mode, extract_custom_fields

router = APIRouter()
logger = logging.getLogger(__name__)

# Type aliases for cleaner parameter definitions
FormStr = Annotated[str, Form()]


class ExtractionResponse(BaseModel):
    """Response model for extraction endpoints."""

    mode: str
    extracted_fields: dict[str, Any]
    confidence_scores: dict[str, float]
    model: str
    processing_time_ms: int
    field_count: int
    requested_fields: list[str] | None = None


def _fetch_ocr_text(document_id: str) -> str:
    """Fetch cached OCR text from database."""
    supabase = get_supabase_client()
    response = supabase.table("ocr_results").select("raw_text").eq("document_id", document_id).single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail=f"No OCR result found for document_id={document_id}")

    text = response.data["raw_text"]
    logger.info(f"Fetched OCR: document_id={document_id}, length={len(text)}")
    return text


def _save_extraction(
    document_id: str,
    user_id: str,
    result: ExtractionResult,
    mode: str,
    model: str,
    processing_time_ms: int,
    custom_fields: list[str] | None = None,
) -> None:
    """Save extraction result to database (non-blocking on failure)."""
    try:
        supabase = get_supabase_client()
        supabase.table("extractions").insert({
            "document_id": document_id,
            "user_id": user_id,
            "extracted_fields": result["extracted_fields"],
            "confidence_scores": result["confidence_scores"],
            "mode": mode,
            "custom_fields": custom_fields,
            "model": model,
            "processing_time_ms": processing_time_ms
        }).execute()
        logger.info(f"Saved extraction: document_id={document_id}, mode={mode}, time={processing_time_ms}ms")
    except Exception as e:
        logger.error(f"Failed to save extraction: {e}")


def _build_response(
    mode: str,
    result: ExtractionResult,
    model: str,
    processing_time_ms: int,
    requested_fields: list[str] | None = None,
) -> ExtractionResponse:
    """Build standardized extraction response."""
    return ExtractionResponse(
        mode=mode,
        extracted_fields=result["extracted_fields"],
        confidence_scores=result["confidence_scores"],
        model=model,
        processing_time_ms=processing_time_ms,
        field_count=len(result["extracted_fields"]),
        requested_fields=requested_fields,
    )


@router.post("/test-extract-auto", response_model=ExtractionResponse)
async def test_extract_auto(document_id: FormStr, user_id: FormStr) -> ExtractionResponse:
    """
    **TEST ENDPOINT** - Auto extraction mode with cached OCR text.

    Fetches OCR text from ocr_results table and runs auto extraction.
    """
    try:
        text = _fetch_ocr_text(document_id)
        settings = get_settings()

        start_time = time.time()
        result = await extract_auto_mode(text)
        processing_time_ms = int((time.time() - start_time) * 1000)

        _save_extraction(document_id, user_id, result, "auto", settings.CLAUDE_MODEL, processing_time_ms)

        return _build_response("auto", result, settings.CLAUDE_MODEL, processing_time_ms)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")


@router.post("/test-extract-custom", response_model=ExtractionResponse)
async def test_extract_custom(
    document_id: FormStr,
    user_id: FormStr,
    custom_fields: FormStr,
) -> ExtractionResponse:
    """
    **TEST ENDPOINT** - Custom extraction mode with cached OCR text.

    Fetches OCR text and extracts only the specified fields.
    custom_fields: Comma-separated field names (e.g., "vendor_name,total_amount")
    """
    try:
        fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]
        if not fields_list:
            raise HTTPException(status_code=400, detail="custom_fields cannot be empty")

        text = _fetch_ocr_text(document_id)
        settings = get_settings()

        start_time = time.time()
        result = await extract_custom_fields(text, fields_list)
        processing_time_ms = int((time.time() - start_time) * 1000)

        _save_extraction(
            document_id, user_id, result, "custom", settings.CLAUDE_MODEL, processing_time_ms, fields_list
        )

        return _build_response("custom", result, settings.CLAUDE_MODEL, processing_time_ms, fields_list)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")
