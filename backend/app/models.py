"""Pydantic models for request/response validation"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from uuid import UUID


# Document Models
class DocumentUploadResponse(BaseModel):
    """Response after uploading a document"""
    document_id: UUID
    filename: str
    status: Literal["processing", "completed", "failed"]
    message: str


class DocumentListItem(BaseModel):
    """Document item in list response"""
    id: UUID
    filename: str
    file_size_bytes: int
    mime_type: str
    mode: Literal["auto", "custom"]
    status: Literal["processing", "completed", "failed"]
    uploaded_at: datetime


# Extraction Models
class ExtractionResponse(BaseModel):
    """Response containing extraction results"""
    extraction_id: UUID
    document_id: UUID
    extracted_fields: dict
    confidence_scores: Optional[dict] = None
    mode: Literal["auto", "custom"]
    created_at: datetime


# Usage Models
class UsageResponse(BaseModel):
    """User's current usage statistics"""
    documents_processed_this_month: int
    documents_limit: int
    subscription_tier: str
    usage_reset_date: datetime


# Health Check
class HealthResponse(BaseModel):
    """API health check response"""
    status: str
    app_name: str
    version: str
    environment: str
