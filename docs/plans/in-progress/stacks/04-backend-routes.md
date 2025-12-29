# Backend Routes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create FastAPI routes for stack operations and SSE streaming extraction.

**Architecture:** Stack routes follow existing document/agent patterns. SSE streaming for extraction with agent tool calls.

**Tech Stack:** FastAPI, Supabase Python client, Claude Agent SDK

---

## Task 1: Create Stack Router

**Files:**
- Create: `backend/app/routes/stack.py`

**Step 1: Implement basic stack CRUD endpoints**

```python
# backend/app/routes/stack.py

from fastapi import APIRouter, Depends, HTTPException, Form
from pydantic import BaseModel
from typing import Optional
from ..database import get_supabase_client
from ..auth import get_current_user

router = APIRouter(prefix="/api/stack", tags=["stack"])


class CreateStackRequest(BaseModel):
    name: str
    description: Optional[str] = None


class AddDocumentRequest(BaseModel):
    document_id: str


@router.post("/create")
async def create_stack(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user),
):
    """Create a new stack."""
    db = get_supabase_client()

    result = db.table("stacks").insert({
        "name": name,
        "description": description,
        "user_id": user_id,
        "status": "active",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create stack")

    return {"stack_id": result.data[0]["id"], "name": name}


@router.post("/{stack_id}/add-document")
async def add_document_to_stack(
    stack_id: str,
    document_id: str = Form(...),
    user_id: str = Depends(get_current_user),
):
    """Add a document to a stack."""
    db = get_supabase_client()

    # Verify stack belongs to user
    stack = db.table("stacks").select("id").eq("id", stack_id).eq("user_id", user_id).single().execute()
    if not stack.data:
        raise HTTPException(status_code=404, detail="Stack not found")

    # Verify document belongs to user
    doc = db.table("documents").select("id").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if already added
    existing = db.table("stack_documents").select("id").eq("stack_id", stack_id).eq("document_id", document_id).execute()
    if existing.data:
        return {"message": "Document already in stack", "stack_document_id": existing.data[0]["id"]}

    # Add document to stack
    result = db.table("stack_documents").insert({
        "stack_id": stack_id,
        "document_id": document_id,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add document to stack")

    return {"stack_document_id": result.data[0]["id"]}


@router.delete("/{stack_id}/remove-document/{document_id}")
async def remove_document_from_stack(
    stack_id: str,
    document_id: str,
    user_id: str = Depends(get_current_user),
):
    """Remove a document from a stack."""
    db = get_supabase_client()

    # Verify stack belongs to user
    stack = db.table("stacks").select("id").eq("id", stack_id).eq("user_id", user_id).single().execute()
    if not stack.data:
        raise HTTPException(status_code=404, detail="Stack not found")

    # Remove from stack
    db.table("stack_documents").delete().eq("stack_id", stack_id).eq("document_id", document_id).execute()

    return {"message": "Document removed from stack"}


@router.post("/{stack_id}/create-table")
async def create_table(
    stack_id: str,
    name: str = Form(...),
    mode: str = Form("auto"),  # auto or custom
    custom_columns: Optional[str] = Form(None),  # JSON string if custom
    user_id: str = Depends(get_current_user),
):
    """Create a new table in a stack."""
    import json

    db = get_supabase_client()

    # Verify stack belongs to user
    stack = db.table("stacks").select("id").eq("id", stack_id).eq("user_id", user_id).single().execute()
    if not stack.data:
        raise HTTPException(status_code=404, detail="Stack not found")

    # Parse custom columns if provided
    columns = None
    if custom_columns:
        try:
            columns = json.loads(custom_columns)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid custom_columns JSON")

    result = db.table("stack_tables").insert({
        "stack_id": stack_id,
        "user_id": user_id,
        "name": name,
        "mode": mode,
        "custom_columns": columns if mode == "custom" else None,
        "status": "pending",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create table")

    return {"table_id": result.data[0]["id"], "name": name}
```

**Step 2: Commit**

```bash
git add backend/app/routes/stack.py
git commit -m "feat(backend): add stack CRUD routes"
```

---

## Task 2: Register Stack Router

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Import and register router**

```python
# In backend/app/main.py, add:
from .routes.stack import router as stack_router

# In the router registration section:
app.include_router(stack_router)
```

**Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(backend): register stack router"
```

---

## Task 3: Create Stack Extraction SSE Endpoint

**Files:**
- Modify: `backend/app/routes/stack.py`

**Step 1: Add extraction endpoint with SSE streaming**

```python
# Add to backend/app/routes/stack.py

from fastapi.responses import StreamingResponse
from typing import AsyncIterator
import json

from ..agents.stack_agent import extract_stack_table


def sse_event(data: dict) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps(data)}\n\n"


@router.post("/{stack_id}/tables/{table_id}/extract")
async def extract_table_data(
    stack_id: str,
    table_id: str,
    user_id: str = Depends(get_current_user),
):
    """Extract data for all documents in stack to table. Returns SSE stream."""
    db = get_supabase_client()

    # Verify stack and table belong to user
    stack = db.table("stacks").select("id, description").eq("id", stack_id).eq("user_id", user_id).single().execute()
    if not stack.data:
        raise HTTPException(status_code=404, detail="Stack not found")

    table = db.table("stack_tables").select("*").eq("id", table_id).eq("stack_id", stack_id).single().execute()
    if not table.data:
        raise HTTPException(status_code=404, detail="Table not found")

    # Get documents in stack
    stack_docs = db.table("stack_documents").select("document_id").eq("stack_id", stack_id).execute()
    document_ids = [sd["document_id"] for sd in (stack_docs.data or [])]

    if not document_ids:
        raise HTTPException(status_code=400, detail="No documents in stack")

    # Update table status
    db.table("stack_tables").update({"status": "processing"}).eq("id", table_id).execute()

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in extract_stack_table(
                stack_id=stack_id,
                table_id=table_id,
                document_ids=document_ids,
                stack_description=stack.data.get("description"),
                table_config=table.data,
                user_id=user_id,
                db=db,
            ):
                yield sse_event(event)
        except Exception as e:
            db.table("stack_tables").update({"status": "failed"}).eq("id", table_id).execute()
            yield sse_event({"error": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/{stack_id}/tables/{table_id}/correct")
async def correct_table_data(
    stack_id: str,
    table_id: str,
    instruction: str = Form(...),
    user_id: str = Depends(get_current_user),
):
    """Correct table data with natural language. Returns SSE stream."""
    db = get_supabase_client()

    # Verify stack and table belong to user
    table = db.table("stack_tables").select("*").eq("id", table_id).eq("stack_id", stack_id).single().execute()
    if not table.data:
        raise HTTPException(status_code=404, detail="Table not found")

    session_id = table.data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="No extraction session to correct")

    from ..agents.stack_agent import correct_stack_table

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in correct_stack_table(
                session_id=session_id,
                table_id=table_id,
                instruction=instruction,
                user_id=user_id,
                db=db,
            ):
                yield sse_event(event)
        except Exception as e:
            yield sse_event({"error": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
```

**Step 2: Commit**

```bash
git add backend/app/routes/stack.py
git commit -m "feat(backend): add stack extraction SSE endpoints"
```

---

## Task 4: Add Bulk Document Add Endpoint

**Files:**
- Modify: `backend/app/routes/stack.py`

**Step 1: Add bulk document endpoint**

```python
# Add to backend/app/routes/stack.py

from typing import List

@router.post("/{stack_id}/add-documents")
async def add_documents_to_stack(
    stack_id: str,
    document_ids: str = Form(...),  # Comma-separated or JSON array
    user_id: str = Depends(get_current_user),
):
    """Add multiple documents to a stack."""
    import json

    db = get_supabase_client()

    # Verify stack belongs to user
    stack = db.table("stacks").select("id").eq("id", stack_id).eq("user_id", user_id).single().execute()
    if not stack.data:
        raise HTTPException(status_code=404, detail="Stack not found")

    # Parse document IDs
    try:
        ids = json.loads(document_ids)
    except json.JSONDecodeError:
        ids = [id.strip() for id in document_ids.split(",")]

    # Verify all documents belong to user
    docs = db.table("documents").select("id").eq("user_id", user_id).in_("id", ids).execute()
    valid_ids = {d["id"] for d in (docs.data or [])}

    # Get existing associations
    existing = db.table("stack_documents").select("document_id").eq("stack_id", stack_id).in_("document_id", list(valid_ids)).execute()
    existing_ids = {e["document_id"] for e in (existing.data or [])}

    # Insert new associations
    new_ids = valid_ids - existing_ids
    if new_ids:
        inserts = [{"stack_id": stack_id, "document_id": doc_id} for doc_id in new_ids]
        db.table("stack_documents").insert(inserts).execute()

    return {
        "added": len(new_ids),
        "already_existed": len(existing_ids),
        "invalid": len(ids) - len(valid_ids),
    }
```

**Step 2: Commit**

```bash
git add backend/app/routes/stack.py
git commit -m "feat(backend): add bulk document add endpoint"
```
