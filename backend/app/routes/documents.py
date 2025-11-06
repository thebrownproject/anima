"""Document upload and management endpoints"""

from typing import cast
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from uuid import UUID
from ..models import DocumentUploadResponse
from ..services.storage import upload_document
from ..services.usage import check_usage_limit, increment_usage
from ..database import get_supabase_client

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
