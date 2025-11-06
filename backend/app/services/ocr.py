"""OCR service for extracting text from documents using Mistral OCR."""

import logging
import time
from typing import TypedDict

from mistralai import Mistral

from ..config import get_settings

logger = logging.getLogger(__name__)


class OCRResult(TypedDict):
    """Result from OCR text extraction with full metadata from Mistral API."""

    text: str  # Markdown-formatted text from Mistral OCR
    status: str  # 'success' or 'failure'
    errors: list[str]
    page_count: int
    processing_time_ms: int  # Time taken for OCR processing
    model: str  # Model used (e.g., "mistral-ocr-latest")
    usage_info: dict  # {pages_processed, doc_size_bytes}
    layout_data: dict | None  # Page-level data (images with full metadata, dimensions)
    document_annotation: str | None  # Structured JSON annotation if available


# Singleton client instance
_client: Mistral | None = None


def _get_client() -> Mistral:
    """Get or create Mistral client singleton."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = Mistral(api_key=settings.MISTRAL_API_KEY)
    return _client


async def extract_text_ocr(document_url: str) -> OCRResult:
    """
    Extract text from document using Mistral OCR.

    Args:
        document_url: Signed URL to document file (from Supabase Storage)

    Returns:
        OCRResult dict with keys:
        - text (str): Extracted markdown-formatted text
        - status (str): 'success' or 'failure'
        - errors (list): Any errors encountered
        - page_count (int): Number of pages processed
        - processing_time_ms (int): Time taken for OCR in milliseconds
        - model (str): Model used (e.g., "mistral-ocr-latest")
        - usage_info (dict): Usage metadata from Mistral API
        - layout_data (dict|None): Page-level data with images (id, coordinates, base64, annotations) and dimensions
        - document_annotation (str|None): Structured JSON annotation if available

    Raises:
        ValueError: If OCR processing completely fails
    """
    from asyncio import to_thread

    start_time = time.time()

    try:
        client = _get_client()

        # Call Mistral OCR API with signed URL directly
        logger.info(f"Starting Mistral OCR for document URL")

        def _call_ocr():
            return client.ocr.process(
                model="mistral-ocr-latest",
                document={
                    "type": "document_url",
                    "document_url": document_url
                },
                include_image_base64=False  # Don't include images to reduce payload size
            )

        ocr_response = await to_thread(_call_ocr)

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Extract pages data
        if not ocr_response.pages:
            raise ValueError("OCR returned no pages")

        # Combine text from all pages
        page_texts = []
        layout_pages = []

        for page in ocr_response.pages:
            # Extract markdown text (primary), fallback to plain text if needed
            if hasattr(page, 'markdown') and page.markdown:
                page_texts.append(page.markdown)
            elif hasattr(page, 'text') and page.text:
                page_texts.append(page.text)

            # Extract layout data (images with all fields, dimensions) if available
            page_layout = {}
            if hasattr(page, 'images') and page.images:
                page_layout['images'] = [
                    {
                        'id': img.id if hasattr(img, 'id') else None,
                        'top_left_x': img.top_left_x if hasattr(img, 'top_left_x') else None,
                        'top_left_y': img.top_left_y if hasattr(img, 'top_left_y') else None,
                        'bottom_right_x': img.bottom_right_x if hasattr(img, 'bottom_right_x') else None,
                        'bottom_right_y': img.bottom_right_y if hasattr(img, 'bottom_right_y') else None,
                        'image_base64': img.image_base64 if hasattr(img, 'image_base64') else None,
                        'image_annotation': img.image_annotation if hasattr(img, 'image_annotation') else None,
                    }
                    for img in page.images
                ]

            if hasattr(page, 'dimensions'):
                dims = page.dimensions
                page_layout['dimensions'] = {
                    'dpi': dims.dpi if hasattr(dims, 'dpi') else None,
                    'height': dims.height if hasattr(dims, 'height') else None,
                    'width': dims.width if hasattr(dims, 'width') else None,
                }

            if hasattr(page, 'index'):
                page_layout['index'] = page.index

            if page_layout:
                layout_pages.append(page_layout)

        # Combine text from all pages
        extracted_text = "\n\n".join(page_texts)

        if not extracted_text:
            raise ValueError("OCR returned empty text from all pages")

        # Extract usage information
        usage_info = {}
        if hasattr(ocr_response, 'usage_info') and ocr_response.usage_info:
            usage = ocr_response.usage_info
            usage_info = {
                'pages_processed': usage.pages_processed if hasattr(usage, 'pages_processed') else None,
                'doc_size_bytes': usage.doc_size_bytes if hasattr(usage, 'doc_size_bytes') else None,
            }

        page_count = len(ocr_response.pages)
        layout_data = {'pages': layout_pages} if layout_pages else None

        # Extract model name
        model = ocr_response.model if hasattr(ocr_response, 'model') else "mistral-ocr-latest"

        # Extract document annotation if available
        document_annotation = None
        if hasattr(ocr_response, 'document_annotation') and ocr_response.document_annotation:
            document_annotation = ocr_response.document_annotation

        logger.info(
            f"OCR success. "
            f"Model: {model}, "
            f"Pages: {page_count}, "
            f"Text length: {len(extracted_text)} chars, "
            f"Processing time: {processing_time_ms}ms"
        )

        return {
            "text": extracted_text,
            "status": "success",
            "errors": [],
            "page_count": page_count,
            "processing_time_ms": processing_time_ms,
            "model": model,
            "usage_info": usage_info,
            "layout_data": layout_data,
            "document_annotation": document_annotation,
        }

    except Exception as e:
        processing_time_ms = int((time.time() - start_time) * 1000)
        error_msg = f"OCR processing failed: {str(e)}"
        logger.error(f"{error_msg} for document URL")
        raise ValueError(error_msg)
