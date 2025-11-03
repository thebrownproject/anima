"""Supabase Storage operations for document file management"""

from uuid import uuid4
from fastapi import UploadFile, HTTPException
from ..database import get_supabase_client


async def upload_document(user_id: str, file: UploadFile) -> dict[str, str | int]:
    """Upload document to Supabase Storage and return metadata."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    try:
        document_id = str(uuid4())
        file_path = f"{user_id}/{document_id}_{file.filename}"
        file_content = await file.read()
        mime_type = file.content_type or "application/octet-stream"

        supabase = get_supabase_client()
        _ = supabase.storage.from_("documents").upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": mime_type, "cache-control": "3600"},
        )

        return {
            "document_id": document_id,
            "file_path": file_path,
            "filename": file.filename,
            "file_size_bytes": len(file_content),
            "mime_type": mime_type,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


async def download_document(file_path: str) -> bytes:
    """Download document from Supabase Storage."""
    try:
        supabase = get_supabase_client()
        return supabase.storage.from_("documents").download(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


async def create_signed_url(file_path: str, expires_in: int = 3600) -> str:
    """Create time-limited signed URL for file download."""
    try:
        supabase = get_supabase_client()
        response = supabase.storage.from_("documents").create_signed_url(
            file_path, expires_in
        )
        return response["signedUrl"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signed URL failed: {str(e)}")


async def delete_document(file_path: str) -> bool:
    """Delete document from Supabase Storage."""
    try:
        supabase = get_supabase_client()
        _ = supabase.storage.from_("documents").remove([file_path])
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
