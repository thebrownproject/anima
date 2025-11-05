"""Document upload and management endpoints"""

from typing import cast
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from uuid import UUID
from ..models import DocumentUploadResponse
from ..services.storage import upload_document, download_document
from ..services.usage import check_usage_limit, increment_usage
from ..services.ocr import extract_text_ocr
from ..database import get_supabase_client

# Type alias for document data from database
DocumentData = dict[str, str | int | bool | None]

router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document_endpoint(
    file: UploadFile = File(...),  # pyright: ignore[reportCallInDefaultInitializer]
    mode: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
) -> DocumentUploadResponse:
    """
    Upload a document for extraction.

    Flow:
    1. Check usage limit (return 403 if exceeded)
    2. Upload file to Supabase Storage
    3. Create document record in database
    4. Increment usage counter
    5. Return document_id (frontend will poll for extraction status)
    """
    # Validate mode
    if mode not in ["auto", "custom"]:
        raise HTTPException(status_code=400, detail="Mode must be 'auto' or 'custom'")

    # Check usage limit
    can_upload = await check_usage_limit(user_id)
    if not can_upload:
        raise HTTPException(
            status_code=403,
            detail="Upload limit reached. Please upgrade your plan."
        )

    # Upload to storage
    upload_result = await upload_document(user_id, file)

    # Create document record in database
    try:
        supabase = get_supabase_client()
        document_data = {
            "id": upload_result["document_id"],
            "user_id": user_id,
            "filename": upload_result["filename"],
            "file_path": upload_result["file_path"],
            "file_size_bytes": upload_result["file_size_bytes"],
            "mime_type": upload_result["mime_type"],
            "mode": mode,
            "status": "processing",
        }

        _ = supabase.table("documents").insert(document_data).execute()

        # Increment usage counter
        _ = await increment_usage(user_id)

        return DocumentUploadResponse(
            document_id=UUID(cast(str, upload_result["document_id"])),
            filename=cast(str, upload_result["filename"]),
            status="processing",
            message="Document uploaded successfully. Extraction in progress."
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create document record: {str(e)}"
        )


@router.post("/test-ocr/{document_id}")
async def test_ocr_extraction(document_id: str, user_id: str = Form(...)) -> dict[str, str | int | list[str] | dict[str, str]]:  # pyright: ignore[reportCallInDefaultInitializer]
    """
    **TEST ENDPOINT** - Extract text from an already uploaded document.

    This endpoint is for testing OCR functionality during development.
    It downloads a document from Supabase Storage and runs OCR extraction.

    Args:
        document_id: UUID of the document to extract text from
        user_id: User ID (to verify ownership via RLS)

    Returns:
        OCR extraction result with text preview
    """
    import tempfile
    import os

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

    # Download document from Supabase Storage
    try:
        file_content = await download_document(file_path)

        # Get file extension from filename
        _, ext = os.path.splitext(filename)

        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            _ = tmp_file.write(file_content)
            tmp_path = tmp_file.name

        try:
            # Run OCR extraction
            ocr_result = await extract_text_ocr(tmp_path)

            # Return result with preview and metadata
            return {
                "document_id": document_id,
                "filename": filename,
                "ocr_status": ocr_result["status"],
                "page_count": ocr_result["page_count"],
                "text_length": len(ocr_result["text"]),
                "processing_time_ms": ocr_result["processing_time_ms"],  # NEW
                "usage_info": ocr_result["usage_info"],  # NEW
                "layout_data": ocr_result["layout_data"],  # NEW
                "errors": ocr_result["errors"],
                "text_preview": {
                    "first_300_chars": ocr_result["text"][:300],
                    "last_300_chars": ocr_result["text"][-300:] if len(ocr_result["text"]) > 300 else ocr_result["text"]
                },
                "full_text": ocr_result["text"]  # Include full text for inspection
            }
        finally:
            # Clean up temporary file
            os.unlink(tmp_path)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {str(e)}")
