"""
LangChain-based extraction service for structured data extraction from documents.

Uses ChatOpenAI with OpenRouter base URL to access Claude models for extraction.
Supports two modes:
- Auto mode: AI decides which fields to extract
- Custom mode: User specifies exact fields to extract
"""

from typing import Any
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from ..config import get_settings

settings = get_settings()


# Pydantic models for structured output
class ExtractedData(BaseModel):
    """Structured data extracted from a document."""

    extracted_fields: dict[str, Any] = Field(
        description="Extracted data as key-value pairs with descriptive field names"
    )
    confidence_scores: dict[str, float] = Field(
        description="Confidence score (0.0 to 1.0) for each extracted field"
    )


def get_llm() -> ChatOpenAI:
    """
    Initialize ChatOpenAI with OpenRouter configuration.

    Returns:
        Configured ChatOpenAI instance using OpenRouter as base URL
    """
    return ChatOpenAI(
        model=settings.OPENROUTER_MODEL,
        temperature=0,  # Deterministic extraction
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
    )


async def extract_auto_mode(text: str) -> dict[str, Any]:
    """
    Extract all relevant fields automatically from document text.

    The AI decides which fields are relevant and extracts them with confidence scores.
    Useful for exploratory extraction or when field names are unknown.

    Args:
        text: Raw text from OCR extraction

    Returns:
        Dictionary with:
        - extracted_fields: Dict of field names to values
        - confidence_scores: Dict of field names to confidence (0.0-1.0)

    Example:
        >>> result = await extract_auto_mode("Invoice #123...")
        >>> result["extracted_fields"]
        {"vendor_name": "Acme Corp", "invoice_number": "123", "total_amount": 150.00}
        >>> result["confidence_scores"]
        {"vendor_name": 0.95, "invoice_number": 1.0, "total_amount": 0.90}
    """
    llm = get_llm()

    # Define prompt for auto extraction
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are an expert document data extraction system.

Your task is to analyze the provided document text and extract ALL relevant structured data.
Use clear, descriptive field names (e.g., "vendor_name", "invoice_date", "total_amount").
For each field, provide a confidence score between 0.0 and 1.0 indicating how certain you are.

Guidelines:
- Extract dates in ISO 8601 format (YYYY-MM-DD)
- Extract monetary amounts as numbers (without currency symbols)
- Use snake_case for field names
- Only extract data that is explicitly present in the document
- If a field value is unclear or missing, omit it rather than guessing
- Common fields to look for: vendor/company names, dates, amounts, IDs, addresses, line items"""
        ),
        ("user", "{text}")
    ])

    # Create chain with structured output using function calling
    chain = prompt | llm.with_structured_output(ExtractedData, method="function_calling")

    # Invoke chain
    result = await chain.ainvoke({"text": text})

    return {
        "extracted_fields": result.extracted_fields,
        "confidence_scores": result.confidence_scores
    }


async def extract_custom_fields(text: str, custom_fields: list[str]) -> dict[str, Any]:
    """
    Extract only specified fields from document text.

    The AI extracts only the fields requested by the user. Useful when you know
    exactly which fields you need.

    Args:
        text: Raw text from OCR extraction
        custom_fields: List of field names to extract (e.g., ["vendor_name", "total_amount"])

    Returns:
        Dictionary with:
        - extracted_fields: Dict of requested field names to values
        - confidence_scores: Dict of field names to confidence (0.0-1.0)

    Example:
        >>> result = await extract_custom_fields("Invoice #123...", ["vendor_name", "total_amount"])
        >>> result["extracted_fields"]
        {"vendor_name": "Acme Corp", "total_amount": 150.00}
        >>> result["confidence_scores"]
        {"vendor_name": 0.95, "total_amount": 0.90}
    """
    llm = get_llm()

    # Format field names for prompt
    fields_str = ", ".join(custom_fields)

    # Define prompt for custom extraction
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            f"""You are an expert document data extraction system.

Your task is to extract ONLY these specific fields from the document: {fields_str}

Return a dictionary with exactly these field names as keys.
For each field, provide a confidence score between 0.0 and 1.0 indicating how certain you are.

Guidelines:
- Extract dates in ISO 8601 format (YYYY-MM-DD)
- Extract monetary amounts as numbers (without currency symbols)
- If a requested field is not found in the document, set its value to null
- Only extract data that is explicitly present in the document
- Do not invent or infer values that aren't clearly stated

Return the data as a structured JSON object with extracted_fields and confidence_scores."""
        ),
        ("user", "{text}")
    ])

    # Create chain with structured output using function calling
    chain = prompt | llm.with_structured_output(ExtractedData, method="function_calling")

    # Invoke chain
    result = await chain.ainvoke({"text": text})

    return {
        "extracted_fields": result.extracted_fields,
        "confidence_scores": result.confidence_scores
    }
