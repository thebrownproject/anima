"""OCR extraction and caching endpoints"""

from typing import cast, Any
from fastapi import APIRouter, Form, HTTPException
from ..services.storage import create_signed_url
from ..services.ocr import extract_text_ocr
from ..database import get_supabase_client

# Type alias for document data from database
DocumentData = dict[str, str | int | bool | None]

router = APIRouter()


@router.post("/test-ocr/{document_id}")
async def test_ocr_extraction(document_id: str, user_id: str = Form(...)) -> dict[str, Any]:  # pyright: ignore[reportCallInDefaultInitializer]
    """
    **TEST ENDPOINT** - Extract text from an already uploaded document.

    This endpoint is for testing OCR functionality during development.
    It creates a signed URL for the document and sends it directly to Mistral OCR.

    Args:
        document_id: UUID of the document to extract text from
        user_id: User ID (to verify ownership via RLS)

    Returns:
        OCR extraction result with text preview
    """
    # Get document metadata from database
    try:
        supabase = get_supabase_client()
        response = supabase.table("documents").select("*").eq("id", document_id).eq("user_id", user_id).execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Document not found or access denied")

        document = cast(DocumentData, response.data[0])
        file_path = cast(str, document["file_path"])
        filename = cast(str, document["filename"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch document: {str(e)}")

    # Create signed URL for document
    try:
        signed_url = await create_signed_url(file_path, expires_in=3600)

        # Run OCR extraction with signed URL
        ocr_result = await extract_text_ocr(signed_url)

        # Save OCR result to database for caching (re-extraction support)
        try:
            ocr_data = {
                "document_id": document_id,
                "user_id": user_id,
                "raw_text": ocr_result["text"],
                "page_count": ocr_result["page_count"],
                "layout_data": ocr_result["layout_data"],  # JSONB (nullable)
                "processing_time_ms": ocr_result["processing_time_ms"],
                "usage_info": ocr_result["usage_info"],  # JSONB
                "model": ocr_result["model"],
                "ocr_engine": "mistral",  # Default value
            }

            # Use upsert to handle re-OCR scenarios (UNIQUE constraint on document_id)
            _ = supabase.table("ocr_results").upsert(ocr_data).execute()

        except Exception as e:
            # Log error but don't fail the request - OCR succeeded, DB save is secondary
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to save OCR result for document {document_id}: {str(e)}")

        # Return result with preview and all metadata
        return {
            "document_id": document_id,
            "filename": filename,
            "ocr_status": ocr_result["status"],
            "model": ocr_result["model"],  # Model used
            "page_count": ocr_result["page_count"],
            "text_length": len(ocr_result["text"]),
            "processing_time_ms": ocr_result["processing_time_ms"],
            "usage_info": ocr_result["usage_info"],  # {pages_processed, doc_size_bytes}
            "layout_data": ocr_result["layout_data"],  # Pages with images (id, coords, base64, annotation) and dimensions
            "document_annotation": ocr_result["document_annotation"],  # Structured annotation if available
            "errors": ocr_result["errors"],
            "text_preview": {
                "first_300_chars": ocr_result["text"][:300],
                "last_300_chars": ocr_result["text"][-300:] if len(ocr_result["text"]) > 300 else ocr_result["text"]
            },
            "full_text": ocr_result["text"]  # Include full text for inspection
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {str(e)}")
