"""
Spike API routes for testing OCR solutions
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import tempfile
import os

from app.spike.test_mistral_ocr import test_mistral_ocr_direct, test_pdf_text_engine
from app.spike.test_mistral_direct import test_mistral_ocr_direct_api


router = APIRouter(prefix="/spike", tags=["spike"])


@router.post("/test-mistral-direct")
async def test_mistral_direct_api_endpoint(file: UploadFile = File(...)):
    """
    Test Mistral OCR Direct API (recommended approach).

    Calls Mistral's OCR API directly to get pure OCR text
    without LLM processing or inflated token usage.
    """
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name

    try:
        # Test Mistral Direct API
        result = await test_mistral_ocr_direct_api(tmp_path)

        return {
            "engine": "mistral-ocr-direct",
            "success": result["success"],
            "text": result["text"],
            "text_length": result["length"],
            "pages_processed": result["pages_processed"],
            "request_id": result["request_id"],
            "error": result["error"],
            "note": "This is the recommended approach - pure OCR text, no LLM processing"
        }
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


@router.post("/test-mistral-ocr")
async def test_mistral_ocr_endpoint(file: UploadFile = File(...)):
    """
    Test Mistral OCR via OpenRouter (NOT recommended - high token usage).

    This approach uses 100K+ tokens for small documents due to LLM processing.
    Use test-mistral-direct instead.
    """
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name

    try:
        # Test Mistral OCR
        result = await test_mistral_ocr_direct(tmp_path)

        return {
            "engine": "mistral-ocr-via-openrouter",
            "success": result["success"],
            "text": result["text"],
            "text_length": result["length"],
            "tokens_used": result["tokens_used"],
            "model": result["model"],
            "error": result["error"],
            "warning": "High token usage! Use /test-mistral-direct instead"
        }
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


@router.post("/test-pdf-text")
async def test_pdf_text_endpoint(file: UploadFile = File(...)):
    """
    Test OpenRouter's free pdf-text engine (for comparison).

    Only works for native PDFs with embedded text.
    """
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name

    try:
        # Test pdf-text engine
        result = await test_pdf_text_engine(tmp_path)

        return {
            "engine": "pdf-text",
            "success": result["success"],
            "text": result["text"],
            "text_length": result["length"],
            "tokens_used": result["tokens_used"],
            "model": result["model"],
            "error": result["error"]
        }
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


@router.post("/compare-all-engines")
async def compare_all_ocr_engines(file: UploadFile = File(...)):
    """
    Compare all three OCR approaches side-by-side.

    Tests:
    1. Mistral OCR Direct API (recommended)
    2. Mistral OCR via OpenRouter (expensive)
    3. pdf-text (free, limited)
    """
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name

    try:
        # Test all three approaches
        mistral_direct = await test_mistral_ocr_direct_api(tmp_path)
        mistral_openrouter = await test_mistral_ocr_direct(tmp_path)
        pdf_text_result = await test_pdf_text_engine(tmp_path)

        return {
            "mistral_direct_api": {
                "success": mistral_direct["success"],
                "text_length": mistral_direct["length"],
                "pages": mistral_direct["pages_processed"],
                "text_preview": mistral_direct["text"][:300] if mistral_direct["text"] else None,
                "error": mistral_direct["error"],
                "recommended": True
            },
            "mistral_via_openrouter": {
                "success": mistral_openrouter["success"],
                "text_length": mistral_openrouter["length"],
                "tokens_used": mistral_openrouter["tokens_used"],
                "text_preview": mistral_openrouter["text"][:300] if mistral_openrouter["text"] else None,
                "error": mistral_openrouter["error"],
                "recommended": False,
                "warning": "High token usage"
            },
            "pdf_text_free": {
                "success": pdf_text_result["success"],
                "text_length": pdf_text_result["length"],
                "tokens_used": pdf_text_result["tokens_used"],
                "text_preview": pdf_text_result["text"][:300] if pdf_text_result["text"] else None,
                "error": pdf_text_result["error"]
            }
        }
    finally:
        # Clean up temp file
        os.unlink(tmp_path)
