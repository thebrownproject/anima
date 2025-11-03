"""Document extraction service (OCR + LLM)"""

import logging
from typing import TypedDict

from docling.datamodel.base_models import ConversionStatus
from docling.document_converter import DocumentConverter

logger = logging.getLogger(__name__)


class OCRResult(TypedDict):
    """Result from OCR text extraction."""

    text: str
    status: str
    errors: list[str]
    page_count: int


# Singleton converter instance (best practice from Docling docs)
_converter: DocumentConverter | None = None


def _get_converter() -> DocumentConverter:
    """Get or create DocumentConverter singleton."""
    global _converter
    if _converter is None:
        _converter = DocumentConverter()
    return _converter


async def extract_text_ocr(file_path: str) -> OCRResult:
    """
    Extract text from document using Docling OCR.

    Args:
        file_path: Absolute path to document file (PDF/image)

    Returns:
        Dict with keys:
        - text (str): Extracted markdown text
        - status (str): 'success', 'partial', 'failure'
        - errors (list): Any errors encountered
        - page_count (int): Number of pages processed

    Raises:
        ValueError: If conversion completely fails
    """
    from asyncio import to_thread

    converter = _get_converter()

    # Wrap synchronous convert() for async compatibility
    result = await to_thread(
        converter.convert,
        source=file_path,
        raises_on_error=False,
        max_file_size=50_000_000,  # 50MB limit
    )

    # Check ConversionStatus before accessing document
    if result.status == ConversionStatus.SUCCESS:
        text = result.document.export_to_markdown(strict_text=True)
        return {
            "text": text,
            "status": "success",
            "errors": [],
            "page_count": len(result.pages) if result.pages else 0,
        }

    if result.status == ConversionStatus.PARTIAL_SUCCESS:
        text = result.document.export_to_markdown(strict_text=True)
        logger.warning(f"Partial OCR success for {file_path}. Errors: {result.errors}")
        return {
            "text": text,
            "status": "partial",
            "errors": [str(e) for e in result.errors],
            "page_count": len(result.pages) if result.pages else 0,
        }

    # Total failure
    error_msg = f"OCR conversion failed: {result.errors}"
    logger.error(f"{error_msg} for file {file_path}")
    raise ValueError(error_msg)


# TODO: Implement LangChain extraction functions (Day 6-7)
# - extract_fields_auto(text) -> dict (LangChain + OpenRouter)
# - extract_fields_custom(text, custom_fields) -> dict (LangChain + OpenRouter)
# - calculate_confidence_scores(extracted_data) -> dict
