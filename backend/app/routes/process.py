"""
Document processing endpoints - AI operations only.

All data reading/writing for frontend goes through Supabase directly.
These endpoints only handle:
- POST /api/process - Full pipeline (upload + OCR + extract)
- POST /api/re-extract - New extraction from cached OCR
"""

import time
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks

from ..services.storage import upload_document, create_signed_url
from ..services.ocr import extract_text_ocr
from ..services.extractor import extract_auto_mode, extract_custom_fields
from ..services.usage import check_usage_limit, increment_usage
from ..database import get_supabase_client
from ..config import get_settings

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


async def process_document_task(
    document_id: str,
    user_id: str,
    file_path: str,
    mode: str, # auto or custom
    custom_fields: list[str] | None = None
) -> None:
    """
    Background task: OCR → Extract → Save results.

    Updates document status to 'completed' or 'failed'.
    Frontend receives update via Supabase Realtime subscription.
    """
    supabase = get_supabase_client()

    try:
        # Step 1: Get signed URL and run OCR with Mistral
        logger.info(f"Starting OCR for document {document_id}")
        signed_url = await create_signed_url(file_path)
        ocr_result = await extract_text_ocr(signed_url)

        # Save OCR result (cache for re-extraction)
        supabase.table("ocr_results").upsert({
            "document_id": document_id,
            "user_id": user_id,
            "raw_text": ocr_result["text"],
            "page_count": ocr_result.get("page_count", 1),
            "model": ocr_result.get("model", "mistral-ocr-latest"),
            "processing_time_ms": ocr_result.get("processing_time_ms", 0),
            "usage_info": ocr_result.get("usage_info", {}),
            "layout_data": ocr_result.get("layout_data"),
        }).execute()
        logger.info(f"OCR complete for document {document_id}")

        # Step 2: Extract with Claude
        logger.info(f"Starting extraction for document {document_id}, mode={mode}")
        start_time = time.time()

        if mode == "custom" and custom_fields:
            result = await extract_custom_fields(ocr_result["text"], custom_fields)
        else:
            result = await extract_auto_mode(ocr_result["text"])

        processing_time_ms = int((time.time() - start_time) * 1000)

        # Step 3: Save extraction
        supabase.table("extractions").insert({
            "document_id": document_id,
            "user_id": user_id,
            "extracted_fields": result["extracted_fields"],
            "confidence_scores": result["confidence_scores"],
            "mode": mode,
            "custom_fields": custom_fields,
            "model": settings.CLAUDE_MODEL,
            "processing_time_ms": processing_time_ms
        }).execute()
        logger.info(f"Extraction saved for document {document_id}")

        # Step 4: Mark document complete
        supabase.table("documents").update({
            "status": "completed"
        }).eq("id", document_id).execute()

        logger.info(f"Processing complete for document {document_id}")

    except Exception as e:
        logger.error(f"Processing failed for document {document_id}: {e}")
        supabase.table("documents").update({
            "status": "failed"
        }).eq("id", document_id).execute()


@router.post("/process")
async def process_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),  # pyright: ignore[reportCallInDefaultInitializer]
    mode: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    custom_fields: str | None = Form(None),  # pyright: ignore[reportCallInDefaultInitializer]
) -> dict[str, Any]:
    """
    Upload and process document (full pipeline).

    Returns immediately with document_id.
    Processing happens in background.
    Frontend subscribes to Supabase Realtime for status updates.

    Args:
        file: Document file (PDF, JPG, PNG)
        mode: "auto" or "custom"
        user_id: User UUID
        custom_fields: Comma-separated field names (required if mode=custom)

    Returns:
        document_id, status, message
    """
    # Validate mode
    if mode not in ["auto", "custom"]:
        raise HTTPException(status_code=400, detail="Mode must be 'auto' or 'custom'")

    if mode == "custom" and not custom_fields:
        raise HTTPException(status_code=400, detail="custom_fields required for custom mode")

    # Check usage limit
    can_upload = await check_usage_limit(user_id)
    if not can_upload:
        raise HTTPException(
            status_code=403,
            detail="Upload limit reached. Please upgrade your plan."
        )

    # Upload file to Supabase Storage
    upload_result = await upload_document(user_id, file)

    # Create document record
    supabase = get_supabase_client()
    supabase.table("documents").insert({
        "id": upload_result["document_id"],
        "user_id": user_id,
        "filename": upload_result["filename"],
        "file_path": upload_result["file_path"],
        "file_size_bytes": upload_result["file_size_bytes"],
        "mime_type": upload_result["mime_type"],
        "mode": mode,
        "status": "processing",
    }).execute()

    # Increment usage counter
    await increment_usage(user_id)

    # Parse custom fields if provided
    fields_list: list[str] | None = None
    if custom_fields:
        fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]

    # Queue background processing
    background_tasks.add_task(
        process_document_task,
        str(upload_result["document_id"]),
        user_id,
        str(upload_result["file_path"]),
        mode,
        fields_list
    )

    return {
        "document_id": upload_result["document_id"],
        "filename": upload_result["filename"],
        "status": "processing",
        "message": "Processing started. Subscribe to Supabase Realtime for updates."
    }


@router.post("/re-extract")
async def re_extract_document(
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    mode: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    custom_fields: str | None = Form(None),  # pyright: ignore[reportCallInDefaultInitializer]
) -> dict[str, Any]:
    """
    Re-extract from cached OCR (no new OCR API call).

    Useful when user wants to:
    - Switch from auto to custom mode
    - Try different custom fields
    - Get a fresh extraction

    Args:
        document_id: Document UUID
        user_id: User UUID
        mode: "auto" or "custom"
        custom_fields: Comma-separated field names (for custom mode)

    Returns:
        New extraction result
    """
    # Validate mode
    if mode not in ["auto", "custom"]:
        raise HTTPException(status_code=400, detail="Mode must be 'auto' or 'custom'")

    if mode == "custom" and not custom_fields:
        raise HTTPException(status_code=400, detail="custom_fields required for custom mode")

    supabase = get_supabase_client()

    # Verify document exists and user owns it
    doc = supabase.table("documents").select("*").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Fetch cached OCR
    ocr = supabase.table("ocr_results").select("raw_text").eq("document_id", document_id).single().execute()
    if not ocr.data:
        raise HTTPException(
            status_code=400,
            detail="No cached OCR found. Use /api/process to process the document first."
        )

    # Parse custom fields
    fields_list: list[str] | None = None
    if custom_fields:
        fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]

    # Run extraction (no OCR - uses cache)
    start_time = time.time()

    if mode == "custom" and fields_list:
        result = await extract_custom_fields(ocr.data["raw_text"], fields_list)
    else:
        result = await extract_auto_mode(ocr.data["raw_text"])

    processing_time_ms = int((time.time() - start_time) * 1000)

    # Save new extraction
    extraction = supabase.table("extractions").insert({
        "document_id": document_id,
        "user_id": user_id,
        "extracted_fields": result["extracted_fields"],
        "confidence_scores": result["confidence_scores"],
        "mode": mode,
        "custom_fields": fields_list,
        "model": settings.CLAUDE_MODEL,
        "processing_time_ms": processing_time_ms
    }).execute()

    return {
        "extraction_id": extraction.data[0]["id"],
        "document_id": document_id,
        "mode": mode,
        "extracted_fields": result["extracted_fields"],
        "confidence_scores": result["confidence_scores"],
        "model": settings.CLAUDE_MODEL,
        "processing_time_ms": processing_time_ms,
        "field_count": len(result["extracted_fields"])
    }
