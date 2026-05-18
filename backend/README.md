# TidySnaps Backend

FastAPI backend for the TidySnaps AI-powered photo and video cleanup app.

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Environment variables

Create a `.env` file (or export to shell):

```
ANTHROPIC_API_KEY=sk-ant-...   # required for provider=claude
GROK_API_KEY=...               # required for provider=grok
OLLAMA_URL=http://localhost:11434   # default
OLLAMA_MODEL=qwen3:8b              # default
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/api/scan` | Scan a folder; returns media list with metadata |
| GET | `/api/duplicates` | Find exact + near-duplicate files in a folder |
| POST | `/api/score` | CV quality scores (blur, brightness) for files |
| POST | `/api/publish` | AI-generated YouTube title / description / tags |

## Project layout

```
backend/
├── main.py                 FastAPI app + CORS + router registration
├── routers/
│   ├── scan.py             POST /api/scan
│   ├── duplicates.py       GET  /api/duplicates
│   ├── score.py            POST /api/score
│   └── publish.py          POST /api/publish
├── services/
│   ├── scanner.py          Folder traversal, metadata extraction
│   ├── duplicate_detector.py  SHA-256 exact + imagehash near-dupe detection
│   ├── cv_scorer.py        OpenCV blur / brightness scoring
│   └── ai_provider.py      Ollama / Claude / Grok abstraction
├── models/
│   └── media.py            Pydantic models (MediaFile, DuplicateGroup, …)
└── requirements.txt
```

## AI providers

Select per-request via the `provider` field in `/api/publish`:

| Value | Model | Cost |
|-------|-------|------|
| `ollama` (default) | qwen3:8b local | Free |
| `claude` | claude-haiku-4-5 | ~$0.001/image |
| `grok` | grok-2-vision | Pay-per-use |

Raw file paths are never sent to external APIs — only base64 JPEG thumbnails (max 512 px).
