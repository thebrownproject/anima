"""
Agent SDK routes - streaming extraction endpoints.

These run alongside existing /api/process and /api/re-extract.
Key difference: These stream Claude's thinking in real-time via SSE.

Endpoints:
- POST /api/agent/extract - Extract with streaming (uses cached OCR)
- POST /api/agent/correct - Correct extraction with session resume
- GET /api/agent/health - Health check
"""

import json
import logging
import time
from typing import AsyncIterator

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import StreamingResponse

from ..services.agent_extractor import extract_with_agent, correct_with_session
from ..database import get_supabase_client
from ..config import get_settings

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


def sse_event(data: dict) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps(data)}\n\n"


@router.post("/extract")
async def extract_with_streaming(
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    mode: str = Form("auto"),  # pyright: ignore[reportCallInDefaultInitializer]
    custom_fields: str | None = Form(None),  # pyright: ignore[reportCallInDefaultInitializer]
):
    """
    Extract from document with SSE streaming.

    Uses cached OCR (document must already be processed via /api/process).
    Streams Claude's thinking in real-time, then saves extraction with session_id.

    Args:
        document_id: Document UUID (must have OCR cached)
        user_id: User UUID
        mode: "auto" or "custom"
        custom_fields: Comma-separated field names (required if mode=custom)

    Returns:
        SSE stream with events:
        - {"type": "status", "message": "..."}
        - {"type": "thinking", "text": "..."}
        - {"type": "complete", "extraction": {...}, "session_id": "...", "extraction_id": "..."}
        - {"type": "error", "message": "..."}
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

    async def event_stream() -> AsyncIterator[str]:
        """Generate SSE events from extraction."""
        yield sse_event({"type": "status", "message": "Starting extraction with Agent SDK..."})

        start_time = time.time()
        extraction_result = None
        session_id = None

        try:
            async for event in extract_with_agent(ocr.data["raw_text"], mode, fields_list):
                if event["type"] == "thinking":
                    yield sse_event(event)

                elif event["type"] == "complete":
                    extraction_result = event["extraction"]
                    session_id = event["session_id"]
                    # Don't yield yet - save to DB first

                elif event["type"] == "error":
                    yield sse_event(event)
                    return

            if extraction_result:
                processing_time_ms = int((time.time() - start_time) * 1000)

                # Save extraction with session_id
                extraction = supabase.table("extractions").insert({
                    "document_id": document_id,
                    "user_id": user_id,
                    "extracted_fields": extraction_result.get("extracted_fields", {}),
                    "confidence_scores": extraction_result.get("confidence_scores", {}),
                    "mode": mode,
                    "custom_fields": fields_list,
                    "model": "claude-agent-sdk",
                    "processing_time_ms": processing_time_ms,
                    "session_id": session_id,  # Store for correction resume
                }).execute()

                # Update document with session_id for easy lookup
                supabase.table("documents").update({
                    "session_id": session_id
                }).eq("id", document_id).execute()

                logger.info(f"Agent extraction saved for document {document_id}, session {session_id}")

                yield sse_event({
                    "type": "complete",
                    "extraction_id": extraction.data[0]["id"],
                    "document_id": document_id,
                    "session_id": session_id,
                    "extracted_fields": extraction_result.get("extracted_fields", {}),
                    "confidence_scores": extraction_result.get("confidence_scores", {}),
                    "processing_time_ms": processing_time_ms,
                })
            else:
                yield sse_event({"type": "error", "message": "No extraction result"})

        except Exception as e:
            logger.error(f"Agent extraction failed for document {document_id}: {e}")
            yield sse_event({"type": "error", "message": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.post("/correct")
async def correct_extraction(
    document_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    user_id: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
    instruction: str = Form(...),  # pyright: ignore[reportCallInDefaultInitializer]
):
    """
    Correct extraction using session resume.

    Resumes the previous Claude session, so Claude remembers:
    - The original document content
    - What it previously extracted
    - The conversation context

    Args:
        document_id: Document UUID
        user_id: User UUID
        instruction: Correction instruction (e.g., "The vendor name should be 'Acme Inc'")

    Returns:
        SSE stream with same event types as /extract
    """
    supabase = get_supabase_client()

    # Verify document exists and user owns it
    doc = supabase.table("documents").select("session_id").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    session_id = doc.data.get("session_id")
    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="No session found for this document. Extract with /api/agent/extract first."
        )

    async def event_stream() -> AsyncIterator[str]:
        """Generate SSE events from correction."""
        yield sse_event({"type": "status", "message": f"Resuming session for correction..."})

        start_time = time.time()
        extraction_result = None

        try:
            async for event in correct_with_session(session_id, instruction):
                if event["type"] == "thinking":
                    yield sse_event(event)

                elif event["type"] == "complete":
                    extraction_result = event["extraction"]
                    # Don't yield yet - save to DB first

                elif event["type"] == "error":
                    yield sse_event(event)
                    return

            if extraction_result:
                processing_time_ms = int((time.time() - start_time) * 1000)

                # Get the latest extraction to find the mode
                latest = supabase.table("extractions").select("mode, custom_fields").eq("document_id", document_id).order("created_at", desc=True).limit(1).single().execute()

                # Save new extraction (correction)
                extraction = supabase.table("extractions").insert({
                    "document_id": document_id,
                    "user_id": user_id,
                    "extracted_fields": extraction_result.get("extracted_fields", {}),
                    "confidence_scores": extraction_result.get("confidence_scores", {}),
                    "mode": latest.data.get("mode", "auto") if latest.data else "auto",
                    "custom_fields": latest.data.get("custom_fields") if latest.data else None,
                    "model": "claude-agent-sdk",
                    "processing_time_ms": processing_time_ms,
                    "session_id": session_id,
                    "is_correction": True,  # Mark as correction
                }).execute()

                logger.info(f"Correction saved for document {document_id}")

                yield sse_event({
                    "type": "complete",
                    "extraction_id": extraction.data[0]["id"],
                    "document_id": document_id,
                    "session_id": session_id,
                    "extracted_fields": extraction_result.get("extracted_fields", {}),
                    "confidence_scores": extraction_result.get("confidence_scores", {}),
                    "processing_time_ms": processing_time_ms,
                    "is_correction": True,
                })
            else:
                yield sse_event({"type": "error", "message": "No extraction result from correction"})

        except Exception as e:
            logger.error(f"Correction failed for document {document_id}: {e}")
            yield sse_event({"type": "error", "message": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/health")
async def agent_health():
    """Check Agent SDK endpoints are available."""
    return {
        "status": "ok",
        "sdk": "claude-agent-sdk",
        "endpoints": ["/api/agent/extract", "/api/agent/correct"]
    }
