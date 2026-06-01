# CreatorLens | Fastify Backend Service

The high-performance, low-overhead Node.js + TypeScript Fastify backend service for CreatorLens. It orchestrates the ingestion pipeline, metadata collection, transcript extraction, embeddings generation, vector storage in pgvector, and LangGraph-powered streaming RAG conversation execution with automated Gemini-to-Groq key failovers.

---

## Technical Stack & Orchestration

* **Web Server Framework:** **Fastify** (chosen for minimal overhead, extreme performance, and native asynchronous chunk/token streaming support).
* **AI Orchestration:** **LangGraph & LangChain** (designed for granular state machines, conversational memory tracking, and multi-turn contextual retrieval).
* **Database & Vector Layer:** **PostgreSQL + pgvector** (chosen for durable tabular data store of users, jobs, conversations, and transcript chunks with robust vector indexing).
* **Language Model Strategy:** **Gemini 3.1 Flash Lite** as primary engine with automatic fallback failover to **Groq (Llama)** on API quota exhaustion or network timeouts.
* **Transcription Service:** `yt-dlp` native captions/subtitles extractor (primary) + local **Whisper CLI** (zero-compute cost local fallback for raw audio transcription).

---

## Installation & Prerequisites

### 1. System Dependencies
Ensure you have the following system utilities installed and available in your environment `PATH`:
* **Node.js:** version 18.x or above.
* **yt-dlp:** Required for primary subtitle download and audio stream acquisition.
  ```bash
  # macOS
  brew install yt-dlp
  ```
* **Whisper CLI (Optional):** Required only if local audio transcription fallback is enabled (`LOCAL_WHISPER_FALLBACK=true`).
  ```bash
  pip install openai-whisper
  ```

### 2. Dependency Setup
Navigate to the `backend` directory and install project dependencies:
```bash
npm install
```

---

## Environment Configuration

Create a `.env` file in the root of the `backend` directory. Below is a description of all parameters:

```env
# Application Settings
NODE_ENV=development
APP_NAME=social-rag-backend
HOST=0.0.0.0
PORT=5050
LOG_LEVEL=info

# CORS Production Origin (monorepo support)
# You can split multiple production urls using commas
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:3000

# LLM Providers
GEMINI_API_KEY=AIzaSy...               # Primary AI engine
GEMINI_MODEL=gemini-3.1-flash-lite
GROQ_API_KEY=gsk_...                   # Secondary AI fallback engine
GEMINI_EMBEDDING_MODEL=gemini-embedding-2

# Database & Vector Settings
DATABASE_URL=postgresql://user:pass@localhost:5432/social_rag
VECTOR_STORE=pgvector
PGVECTOR_TABLE=video_chunks

# Whisper Fallback Configuration
LOCAL_WHISPER_FALLBACK=true
WHISPER_COMMAND=whisper
WHISPER_MODEL=base
WHISPER_LANGUAGE=en

# Clerk Security Credentials
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

---

## Database Schema & Migrations

CreatorLens boots up database tables automatically on startup, but you can manually initialize/check tables. See the SQL definition in `db/migrations/init.sql` for structure details. 

Key tables configured:
* `app_users`: Keeps synced user accounts from Clerk.
* `videos`: Stores YouTube and Instagram Reels transcripts and analytics.
* `ingest_jobs`: Tracks transcript chunk processing status.
* `conversations`: Stores conversation metadata and titles.
* `conversation_turns`: Stores turns, roles, transcript evidence, and citations with cascade deletions enabled.

---

## Production CORS & Allowed Methods

To facilitate secure cross-site deployments (e.g., Render backend + Vercel frontend), CORS is dynamically configured inside [app.ts](src/app.ts):
* Splits `FRONTEND_ORIGIN` by commas to support multiple domains.
* Automatically permits requests from any Vercel deployment preview ending in `.vercel.app`.
* Explicitly permits required preflight methods: `['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH']`.
* Bypasses header locks for standard tools/curl where origin headers are empty.

---

## Available Scripts

### 1. Run in Development Mode
Starts the server using `tsx` (TypeScript Execute) in watch mode, automatically reloading on file edits:
```bash
npm run dev
```

### 2. Compile for Production
Generates optimized JavaScript output inside the `dist/` directory:
```bash
npm run build
```

### 3. Run Production Server
Starts the compiled JavaScript server:
```bash
npm run start
```

### 4. Code Quality & Typechecks
Verifies code type safety and schema parsing:
```bash
npm run typecheck
```
