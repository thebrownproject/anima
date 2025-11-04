"""
Spike: Test Mistral OCR Direct API

Tests calling Mistral's OCR API directly (not through OpenRouter)
to get pure OCR text without LLM processing.
"""
import base64
import requests
from typing import Any
from ..config import get_settings

settings = get_settings()


async def test_mistral_ocr_direct_api(file_path: str) -> dict[str, Any]:
    """
    Test Mistral OCR via direct API call.

    Endpoint: https://api.mistral.ai/v1/ocr
    Docs: https://docs.mistral.ai/capabilities/document_ai/basic_ocr

    Args:
        file_path: Path to PDF file

    Returns:
        dict with 'text', 'success', and 'error' keys
    """
    try:
        # Read and encode PDF
        with open(file_path, "rb") as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

        print("🧪 Testing Mistral OCR Direct API...")

        # Call Mistral OCR API directly
        response = requests.post(
            "https://api.mistral.ai/v1/ocr",
            headers={
                "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "mistral-ocr-latest",
                "document": {
                    "type": "base64",
                    "content": pdf_base64,
                    "mime_type": "application/pdf"
                },
                "include_image_base64": False
            },
            timeout=60
        )

        response.raise_for_status()
        result = response.json()

        # Extract pure text from result
        raw_text = result.get("content", "")

        return {
            "success": True,
            "text": raw_text,
            "length": len(raw_text),
            "pages_processed": result.get("usage", {}).get("pages", None),
            "request_id": response.headers.get("x-request-id"),
            "error": None
        }

    except requests.exceptions.HTTPError as e:
        return {
            "success": False,
            "text": "",
            "length": 0,
            "pages_processed": None,
            "request_id": None,
            "error": f"HTTP Error: {e.response.status_code} - {e.response.text}"
        }
    except Exception as e:
        return {
            "success": False,
            "text": "",
            "length": 0,
            "pages_processed": None,
            "request_id": None,
            "error": str(e)
        }
