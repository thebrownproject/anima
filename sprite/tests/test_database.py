"""Tests for async SQLite database layer."""

from __future__ import annotations

import asyncio
import uuid

import pytest

from src.database import Database


DEFAULT_TABLES = {"documents", "ocr_results", "extractions", "memory_fts"}


@pytest.fixture
async def db(tmp_path):
    """Yield a connected Database using a temp file, close after test."""
    path = str(tmp_path / "test.db")
    database = Database(db_path=path)
    await database.connect()
    yield database
    await database.close()


# -- Schema creation ---------------------------------------------------------

async def test_schema_creates_all_tables(db):
    """All four tables exist after connect: documents, ocr_results, extractions, memory_fts."""
    rows = await db.fetchall(
        "SELECT name FROM sqlite_master WHERE type IN ('table') "
        "AND name NOT LIKE 'sqlite_%'"
    )
    table_names = {r["name"] for r in rows}
    assert DEFAULT_TABLES.issubset(table_names), f"Missing tables: {DEFAULT_TABLES - table_names}"


async def test_memory_fts_is_fts5_virtual_table(db):
    """memory_fts is created as an FTS5 virtual table."""
    rows = await db.fetchall(
        "SELECT sql FROM sqlite_master WHERE name = 'memory_fts'"
    )
    assert len(rows) == 1
    assert "fts5" in rows[0]["sql"].lower()


async def test_schema_idempotent(tmp_path):
    """Calling connect twice on same DB doesn't fail (IF NOT EXISTS)."""
    path = str(tmp_path / "idempotent.db")
    db1 = Database(db_path=path)
    await db1.connect()
    await db1.close()

    db2 = Database(db_path=path)
    await db2.connect()
    rows = await db2.fetchall(
        "SELECT name FROM sqlite_master WHERE type IN ('table') "
        "AND name NOT LIKE 'sqlite_%'"
    )
    table_names = {r["name"] for r in rows}
    assert DEFAULT_TABLES.issubset(table_names)
    await db2.close()


# -- WAL mode ----------------------------------------------------------------

async def test_wal_mode_enabled(db):
    """PRAGMA journal_mode returns 'wal'."""
    row = await db.fetchone("PRAGMA journal_mode")
    assert row["journal_mode"] == "wal"


# -- CRUD: documents ---------------------------------------------------------

async def test_documents_insert_and_select(db):
    doc_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO documents (id, filename, file_path, file_size_bytes, mime_type) "
        "VALUES (?, ?, ?, ?, ?)",
        (doc_id, "invoice.pdf", "/workspace/uploads/invoice.pdf", 12345, "application/pdf"),
    )
    row = await db.fetchone("SELECT * FROM documents WHERE id = ?", (doc_id,))
    assert row["filename"] == "invoice.pdf"
    assert row["file_size_bytes"] == 12345
    assert row["status"] == "processing"  # default
    assert row["uploaded_at"] is not None


async def test_documents_update(db):
    doc_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO documents (id, filename, file_path, file_size_bytes, mime_type) "
        "VALUES (?, ?, ?, ?, ?)",
        (doc_id, "old.pdf", "/workspace/uploads/old.pdf", 100, "application/pdf"),
    )
    await db.execute(
        "UPDATE documents SET display_name = ?, status = ? WHERE id = ?",
        ("Renamed", "completed", doc_id),
    )
    row = await db.fetchone("SELECT * FROM documents WHERE id = ?", (doc_id,))
    assert row["display_name"] == "Renamed"
    assert row["status"] == "completed"


async def test_documents_delete(db):
    doc_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO documents (id, filename, file_path, file_size_bytes, mime_type) "
        "VALUES (?, ?, ?, ?, ?)",
        (doc_id, "trash.pdf", "/workspace/uploads/trash.pdf", 50, "application/pdf"),
    )
    await db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    row = await db.fetchone("SELECT * FROM documents WHERE id = ?", (doc_id,))
    assert row is None


async def test_documents_status_check_constraint(db):
    """Invalid status value should raise an IntegrityError."""
    doc_id = str(uuid.uuid4())
    with pytest.raises(Exception):
        await db.execute(
            "INSERT INTO documents (id, filename, file_path, file_size_bytes, mime_type, status) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (doc_id, "bad.pdf", "/path", 1, "application/pdf", "INVALID_STATUS"),
        )


# -- CRUD: ocr_results ------------------------------------------------------

async def test_ocr_results_insert_and_select(db):
    doc_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO documents (id, filename, file_path, file_size_bytes, mime_type) "
        "VALUES (?, ?, ?, ?, ?)",
        (doc_id, "scan.pdf", "/workspace/uploads/scan.pdf", 5000, "application/pdf"),
    )
    ocr_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO ocr_results (id, document_id, ocr_file_path, page_count, processing_time_ms, model) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (ocr_id, doc_id, f"/workspace/ocr/{doc_id}.md", 3, 1200, "mistral-ocr"),
    )
    row = await db.fetchone("SELECT * FROM ocr_results WHERE id = ?", (ocr_id,))
    assert row["document_id"] == doc_id
    assert row["page_count"] == 3
    assert row["model"] == "mistral-ocr"


async def test_ocr_results_unique_document_id(db):
    """Only one OCR result per document (UNIQUE constraint)."""
    doc_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO documents (id, filename, file_path, file_size_bytes, mime_type) "
        "VALUES (?, ?, ?, ?, ?)",
        (doc_id, "dup.pdf", "/path", 100, "application/pdf"),
    )
    await db.execute(
        "INSERT INTO ocr_results (id, document_id, ocr_file_path, page_count, processing_time_ms, model) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), doc_id, "/workspace/ocr/x.md", 1, 500, "mistral-ocr"),
    )
    with pytest.raises(Exception):
        await db.execute(
            "INSERT INTO ocr_results (id, document_id, ocr_file_path, page_count, processing_time_ms, model) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), doc_id, "/workspace/ocr/y.md", 2, 600, "claude-pdf"),
        )


# -- CRUD: extractions ------------------------------------------------------

async def test_extractions_insert_and_select(db):
    doc_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO documents (id, filename, file_path, file_size_bytes, mime_type) "
        "VALUES (?, ?, ?, ?, ?)",
        (doc_id, "inv.pdf", "/path", 200, "application/pdf"),
    )
    ext_id = str(uuid.uuid4())
    fields_json = '{"vendor": "Acme", "total": 150.00}'
    await db.execute(
        "INSERT INTO extractions (id, document_id, extracted_fields, mode) "
        "VALUES (?, ?, ?, ?)",
        (ext_id, doc_id, fields_json, "auto"),
    )
    row = await db.fetchone("SELECT * FROM extractions WHERE id = ?", (ext_id,))
    assert row["extracted_fields"] == fields_json
    assert row["status"] == "completed"  # default


async def test_extractions_update_and_delete(db):
    doc_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO documents (id, filename, file_path, file_size_bytes, mime_type) "
        "VALUES (?, ?, ?, ?, ?)",
        (doc_id, "x.pdf", "/path", 10, "application/pdf"),
    )
    ext_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO extractions (id, document_id, extracted_fields, mode) "
        "VALUES (?, ?, ?, ?)",
        (ext_id, doc_id, '{}', "manual"),
    )
    await db.execute(
        "UPDATE extractions SET status = ? WHERE id = ?",
        ("failed", ext_id),
    )
    row = await db.fetchone("SELECT * FROM extractions WHERE id = ?", (ext_id,))
    assert row["status"] == "failed"

    await db.execute("DELETE FROM extractions WHERE id = ?", (ext_id,))
    assert await db.fetchone("SELECT * FROM extractions WHERE id = ?", (ext_id,)) is None


# -- CRUD: memory_fts -------------------------------------------------------

async def test_memory_fts_insert_and_search(db):
    await db.execute(
        "INSERT INTO memory_fts (chunk_id, content, source_file, agent_id) "
        "VALUES (?, ?, ?, ?)",
        ("c1", "The user prefers dark mode and metric units", "user.md", "agent-1"),
    )
    await db.execute(
        "INSERT INTO memory_fts (chunk_id, content, source_file, agent_id) "
        "VALUES (?, ?, ?, ?)",
        ("c2", "Stack processes invoices from Acme Corp", "soul.md", "agent-1"),
    )
    rows = await db.fetchall(
        "SELECT chunk_id, content FROM memory_fts WHERE memory_fts MATCH ?",
        ("invoices",),
    )
    assert len(rows) == 1
    assert rows[0]["chunk_id"] == "c2"


async def test_memory_fts_delete(db):
    await db.execute(
        "INSERT INTO memory_fts (chunk_id, content, source_file, agent_id) "
        "VALUES (?, ?, ?, ?)",
        ("d1", "temporary memory", "scratch.md", "agent-1"),
    )
    await db.execute("DELETE FROM memory_fts WHERE chunk_id = ?", ("d1",))
    rows = await db.fetchall(
        "SELECT * FROM memory_fts WHERE memory_fts MATCH ?", ("temporary",)
    )
    assert len(rows) == 0


# -- Concurrent reads (WAL) -------------------------------------------------

async def test_concurrent_reads_dont_block(db):
    """Multiple concurrent reads complete without blocking each other (WAL mode)."""
    doc_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO documents (id, filename, file_path, file_size_bytes, mime_type) "
        "VALUES (?, ?, ?, ?, ?)",
        (doc_id, "concurrent.pdf", "/path", 1, "application/pdf"),
    )

    async def read_doc():
        return await db.fetchone("SELECT * FROM documents WHERE id = ?", (doc_id,))

    results = await asyncio.gather(*[read_doc() for _ in range(10)])
    assert all(r["id"] == doc_id for r in results)


# -- Database file path ------------------------------------------------------

async def test_db_file_created_at_path(tmp_path):
    """Database file is created at the specified path."""
    import os
    path = str(tmp_path / "custom.db")
    assert not os.path.exists(path)

    database = Database(db_path=path)
    await database.connect()
    assert os.path.exists(path)
    await database.close()


async def test_default_path_is_workspace():
    """Default db_path points to /workspace/agent.db."""
    database = Database()
    assert database.db_path == "/workspace/agent.db"


# -- Context manager ---------------------------------------------------------

async def test_context_manager(tmp_path):
    """Database works as async context manager."""
    path = str(tmp_path / "ctx.db")
    async with Database(db_path=path) as database:
        rows = await database.fetchall(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'documents'"
        )
        assert len(rows) == 1
