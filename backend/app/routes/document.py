"""
Document upload endpoint - OCR only.

Handles document upload and OCR processing synchronously.
Extraction is handled separately via /api/agent/extract.
"""

import logging
from typing import Any

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from ..services.storage import upload_document, create_signed_url
from ..services.ocr import extract_text_ocr
from ..services.usage import check_usage_limit, increment_usage
from ..database import get_supabase_client

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/document/upload")
async def upload_and_ocr(
    file: UploadFile = File(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
) -> dict[str, Any]:
    """
    Upload document and run OCR (synchronous).

    Returns full OCR result directly - no background processing.
    Frontend can immediately show document preview after this completes.

    Args:
        file: Document file (PDF, JPG, PNG)
        user_id: User UUID

    Returns:
        document_id, filename, status, ocr_result
    """
    # Check usage limit
    can_upload = await check_usage_limit(user_id)
    if not can_upload:
        raise HTTPException(
            status_code=403,
            detail="Upload limit reached. Please upgrade your plan."
        )

    # Upload file to Supabase Storage
    upload_result = await upload_document(user_id, file)
    document_id = str(upload_result["document_id"])

    supabase = get_supabase_client()

    try:
        # Create document record with 'processing' status
        supabase.table("documents").insert({
            "id": document_id,
            "user_id": user_id,
            "filename": upload_result["filename"],
            "file_path": upload_result["file_path"],
            "file_size_bytes": upload_result["file_size_bytes"],
            "mime_type": upload_result["mime_type"],
            "mode": "auto",  # Default, will be set properly during extraction
            "status": "processing",
        }).execute()

        # Get signed URL and run OCR
        logger.info(f"Starting OCR for document {document_id}")
        signed_url = await create_signed_url(str(upload_result["file_path"]))
        ocr_result = await extract_text_ocr(signed_url)

        # Save OCR result
        supabase.table("ocr_results").upsert({
            "document_id": document_id,
            "user_id": user_id,
            "raw_text": ocr_result["text"],
            "html_tables": ocr_result.get("html_tables"),
            "page_count": ocr_result.get("page_count", 1),
            "model": ocr_result.get("model", "mistral-ocr-latest"),
            "processing_time_ms": ocr_result.get("processing_time_ms", 0),
            "usage_info": ocr_result.get("usage_info", {}),
            "layout_data": ocr_result.get("layout_data"),
        }).execute()

        # Update document status to ocr_complete
        supabase.table("documents").update({
            "status": "ocr_complete"
        }).eq("id", document_id).execute()

        # Increment usage counter
        await increment_usage(user_id)

        logger.info(f"OCR complete for document {document_id}")

        return {
            "document_id": document_id,
            "filename": upload_result["filename"],
            "status": "ocr_complete",
            "ocr_result": {
                "raw_text": ocr_result["text"],
                "html_tables": ocr_result.get("html_tables"),
                "page_count": ocr_result.get("page_count", 1),
                "processing_time_ms": ocr_result.get("processing_time_ms", 0),
                "model": ocr_result.get("model", "mistral-ocr-latest"),
            }
        }

    except Exception as e:
        logger.error(f"OCR failed for document {document_id}: {e}")
        # Update document status to failed
        supabase.table("documents").update({
            "status": "failed"
        }).eq("id", document_id).execute()
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )


@router.post("/document/retry-ocr")
async def retry_ocr(
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
) -> dict[str, Any]:
    """
    Retry OCR on an existing document (for failed OCR recovery).

    Use when:
    - File uploaded successfully but OCR failed
    - User clicks "Retry" button after error

    Args:
        document_id: Existing document UUID
        user_id: User UUID

    Returns:
        document_id, status, ocr_result
    """
    supabase = get_supabase_client()

    # Verify document exists and user owns it
    doc = supabase.table("documents").select("file_path, filename").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update status to processing
    supabase.table("documents").update({
        "status": "processing"
    }).eq("id", document_id).execute()

    try:
        # Get signed URL and run OCR
        logger.info(f"Retrying OCR for document {document_id}")
        signed_url = await create_signed_url(doc.data["file_path"])
        ocr_result = await extract_text_ocr(signed_url)

        # Save/update OCR result
        supabase.table("ocr_results").upsert({
            "document_id": document_id,
            "user_id": user_id,
            "raw_text": ocr_result["text"],
            "html_tables": ocr_result.get("html_tables"),
            "page_count": ocr_result.get("page_count", 1),
            "model": ocr_result.get("model", "mistral-ocr-latest"),
            "processing_time_ms": ocr_result.get("processing_time_ms", 0),
            "usage_info": ocr_result.get("usage_info", {}),
            "layout_data": ocr_result.get("layout_data"),
        }).execute()

        # Update document status
        supabase.table("documents").update({
            "status": "ocr_complete"
        }).eq("id", document_id).execute()

        logger.info(f"OCR retry complete for document {document_id}")

        return {
            "document_id": document_id,
            "filename": doc.data["filename"],
            "status": "ocr_complete",
            "ocr_result": {
                "raw_text": ocr_result["text"],
                "html_tables": ocr_result.get("html_tables"),
                "page_count": ocr_result.get("page_count", 1),
                "processing_time_ms": ocr_result.get("processing_time_ms", 0),
                "model": ocr_result.get("model", "mistral-ocr-latest"),
            }
        }

    except Exception as e:
        logger.error(f"OCR retry failed for document {document_id}: {e}")
        supabase.table("documents").update({
            "status": "failed"
        }).eq("id", document_id).execute()
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )
