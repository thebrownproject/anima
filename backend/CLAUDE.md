# Backend CLAUDE.md

## Quick Facts

- **Framework**: FastAPI (Python 3.11+)
- **AI**: Claude Agent SDK with custom tools
- **OCR**: Mistral OCR API (`mistral-ocr-latest`)
- **Database**: Supabase PostgreSQL (service role key)
- **Auth**: Clerk JWT verification
- **Deployment**: DigitalOcean Droplet → Caddy → Docker

## Directory Structure

```
backend/
├── app/
│   ├── main.py                   # FastAPI app entry point
│   ├── auth.py                   # Clerk JWT verification
│   ├── config.py                 # Environment config
│   ├── database.py               # Supabase client setup
│   ├── models.py                 # Pydantic models
│   ├── routes/
│   │   ├── document.py           # /api/document/* (upload, retry-ocr)
│   │   ├── agent.py              # /api/agent/* (extract, correct)
│   │   └── test.py               # /api/test/* (claude, mistral)
│   ├── services/
│   │   ├── ocr.py                # Mistral OCR integration
│   │   ├── storage.py            # Supabase Storage operations
│   │   └── usage.py              # Usage limit tracking
│   └── agents/
│       ├── extraction_agent/     # Single document extraction
│       │   └── tools/            # read_ocr, save_extraction, set_field, etc.
│       └── stack_agent/          # Multi-document batch extraction
│           └── tools/            # read_documents, create_table, create_row, etc.
├── migrations/                   # SQL migration files
└── tests/                        # Test files
```

## Agents

Built with Claude Agent SDK. Agents operate autonomously with database tools.

### extraction_agent

Extracts structured data from a single document. Reads OCR text, writes JSONB to `extractions` table.

| Tool              | Purpose                       |
| ----------------- | ----------------------------- |
| `read_ocr`        | Fetch OCR text for document   |
| `read_extraction` | Read current extraction JSONB |
| `save_extraction` | Write full extraction         |
| `set_field`       | Update value at JSON path     |
| `delete_field`    | Remove field at JSON path     |
| `complete`        | Mark extraction complete      |

### stack_agent

Extracts across multiple documents into a unified table schema. One row per document.

| Tool               | Purpose                        |
| ------------------ | ------------------------------ |
| `read_documents`   | List documents in stack        |
| `read_ocr`         | Fetch OCR text for document    |
| `read_tables`      | Read table definitions         |
| `create_table`     | Create new table               |
| `add_column`       | Add column to table            |
| `set_column`       | Modify column definition       |
| `delete_column`    | Remove column from table       |
| `read_rows`        | Read existing rows             |
| `create_row`       | Insert new row                 |
| `set_row_field`    | Update value at JSON path      |
| `delete_row_field` | Remove field at JSON path      |
| `complete`         | Mark stack extraction complete |

## API Endpoints

### Document

| Endpoint                       | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `POST /api/document/upload`    | Upload file, run Mistral OCR, save to `ocr_results` |
| `POST /api/document/retry-ocr` | Retry OCR on failed documents                |

### Agent

| Endpoint                  | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `POST /api/agent/extract` | Trigger extraction_agent (SSE streaming)     |
| `POST /api/agent/correct` | Resume session with correction instruction   |
| `GET /api/agent/health`   | Agent health check                           |

### Test

| Endpoint               | Purpose                     |
| ---------------------- | --------------------------- |
| `GET /api/test/claude` | Test Claude SDK connectivity |
| `GET /api/test/mistral`| Test Mistral OCR connectivity |

## Environment Variables

```
# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_service_role_key  # Use service role key (not anon)

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_xxx
CLERK_AUTHORIZED_PARTIES=http://localhost:3000,https://www.stackdocs.io

# AI Services
ANTHROPIC_API_KEY=sk-ant-xxx
CLAUDE_MODEL=claude-haiku-4-5  # or claude-sonnet-4-20250514
MISTRAL_API_KEY=your_mistral_api_key

# Application
ENVIRONMENT=development  # development | staging | production
DEBUG=True  # True: Swagger testing without JWT, False: Full JWT validation

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

## Deployment

- **URL**: `api.stackdocs.io`
- **Host**: DigitalOcean Droplet (2GB, Sydney)
- **Proxy**: Caddy (auto HTTPS)
- **CI/CD**: GitHub Actions on push to `main` when `backend/**` changes

```bash
docker logs stackdocs-api -f    # View logs
docker restart stackdocs-api    # Restart
docker ps | grep stackdocs      # Check status
```
