"""
Spike: Test Mistral OCR via OpenRouter

Tests if we can use OpenRouter's Mistral OCR transform to extract pure text from PDFs
without requiring LLM processing.
"""
import base64
from typing import Any, cast
from openai import OpenAI
from ..config import get_settings

settings = get_settings()


async def test_mistral_ocr_direct(file_path: str) -> dict[str, Any]:
    """
    Test Mistral OCR via OpenRouter's transform feature.

    Args:
        file_path: Path to PDF file to process

    Returns:
        dict with 'text', 'success', and 'error' keys
    """
    # Initialize OpenAI client with OpenRouter
    client = OpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1"
    )

    try:
        # Read and encode PDF
        with open(file_path, "rb") as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

        # Test 1: Try with mistral-ocr via plugins
        print("🧪 Testing Mistral OCR via OpenRouter plugins...")
        response = client.chat.completions.create(
            model="anthropic/claude-3.5-sonnet",  # Model required by OpenRouter
            messages=[{
                "role": "user",
                "content": f"Extract all text from this document. Return only the raw text content, no analysis or commentary.\n\nDocument: data:application/pdf;base64,{pdf_base64}"
            }],
            extra_body={
                "plugins": [{
                    "id": "file-parser",
                    "pdf": {
                        "engine": "mistral-ocr"
                    }
                }]
            }
        )

        extracted_text = response.choices[0].message.content

        return {
            "success": True,
            "text": extracted_text,
            "length": len(extracted_text) if extracted_text else 0,
            "tokens_used": response.usage.total_tokens if response.usage else None,
            "model": response.model,
            "error": None
        }

    except Exception as e:
        return {
            "success": False,
            "text": "",
            "length": 0,
            "tokens_used": None,
            "model": None,
            "error": str(e)
        }


async def test_pdf_text_engine(file_path: str) -> dict[str, Any]:
    """
    Test OpenRouter's free pdf-text engine (for comparison).

    Args:
        file_path: Path to PDF file to process

    Returns:
        dict with 'text', 'success', and 'error' keys
    """
    client = OpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1"
    )

    try:
        # Read and encode PDF
        with open(file_path, "rb") as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

        print("🧪 Testing pdf-text engine (free)...")
        response = client.chat.completions.create(
            model="anthropic/claude-3.5-sonnet",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "file",
                        "file": {
                            "url": f"data:application/pdf;base64,{pdf_base64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": "Extract all text from this document. Return only the raw text content."
                    }
                ]
            }],
            extra_body={
                "transforms": ["pdf-text"]  # Free text extraction
            }
        )

        extracted_text = response.choices[0].message.content

        return {
            "success": True,
            "text": extracted_text,
            "length": len(extracted_text) if extracted_text else 0,
            "tokens_used": response.usage.total_tokens if response.usage else None,
            "model": response.model,
            "error": None
        }

    except Exception as e:
        return {
            "success": False,
            "text": "",
            "length": 0,
            "tokens_used": None,
            "model": None,
            "error": str(e)
        }
