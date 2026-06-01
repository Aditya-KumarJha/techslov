# CreatorLens Backend | Fastify & LangGraph RAG Service

The core, high-performance, and beautifully engineered backend service powering the CreatorLens Social RAG Studio. This service handles parallel multi-source ingestion, native captions parsing, fallback Whisper audio transcription, database schema bootstrapping, pgvector semantic retrieval, and agentic multi-turn conversation workflows utilizing LangGraph.

---

## ⚡ Technical Foundations & Decisive Stack Choices

Every module in the CreatorLens backend was engineered to satisfy strict high-throughput and optimized-cost production parameters:

### 1. Fastify Framework
* **The Architecture:** Built with Fastify (instead of Express or NestJS) to handle high-frequency concurrent operations with **near-zero execution overhead**. 
* **SSE Stream Piping:** Leverages Fastify's native node stream routing to pipe Server-Sent Events (SSE) directly from our AI orchestration layer to the client, providing a sub-10ms time-to-first-token streaming experience.

### 2. Relational pgvector Store
* **The Architecture:** Rather than introducing third-party vector databases, we utilize PostgreSQL's `pgvector` extension.
* **Metadata Splitting:** Relational SQL indexes let us filter chunks semantically with exact metadata constraints (`video_id = 'A'` or `video_id = 'B'`) in single-step queries, eliminating high latency and cross-network latency.

### 3. Agentic LangGraph Workflows
* **The Architecture:** Standard linear chain RAG systems fail when creators ask compound comparative questions. LangGraph implements a **stateful agentic graph loop**:
  1. **Query Analysis Node:** Examines the user query and isolates whether it needs metadata lookup (e.g., follower counts), transcript details for Video A, transcript details for Video B, or a relational comparison.
  2. **Selective Retrieval Node:** Dynamically queries pgvector with specific filters based on the step 1 plan.
  3. **Comparative Synthesis Node:** Merges the retrieved semantic chunks and relational metrics, feeding them into the Gemini/Groq LLM to draft a structured response with exact segment timeline references.
  4. **State memory:** The graph maintains state transitions, citations, and conversation turns automatically across sessions.

---

## 🏗️ System Directories & File Organization

The codebase is structured logically to ensure clean separation of concerns and rapid maintainability:

```
src/
├── config/                 # Environment validation via Zod (env.ts)
├── db/                     # PostgreSQL connection pool and database schema bootstrappers
├── lib/
│   ├── auth/               # Clerk user synchronization and JWT session decoders
│   ├── runtime/            # Application dependency injection container (app-container.ts)
│   ├── state/              # Active storage drivers for conversations, jobs, and video registries
│   └── transcript/         # yt-dlp parsers and local Whisper CLI transcription adapters
├── middlewares/            # Global Fastify exception handlers and 404 controllers
├── modules/
│   ├── chat/               # Fastify routes and controller adapters for LangGraph chat streams
│   ├── health/             # Micro-service health check and Render container warmups
│   ├── ingest/             # Multi-source parallel ingestion orchestrators
│   └── videos/             # Metadata metrics queries and statistics resolvers
├── routes/                 # Global Fastify routing maps
├── server.ts               # Server bootstrap entry point
└── types/                  # Shareable database interfaces and schemas
```

---

## 🎙️ Transcript Ingestion Strategy

To support massive parallel scale without incurring expensive transcription costs, CreatorLens uses a multi-tier ingestion algorithm:

```
                    Ingested Video URL
                            │
                            ▼
               [Check Platform Subtitles?]
               /                         \
         (Yes) /                         \ (No)
              ▼                           ▼
      Parse Native Subtitles          Acquire Audio Stream
     (WebVTT, JSON3, XML, VTT)           via yt-dlp
              │                           │
              │                           ▼
              │                     Invoke Local Whisper
              │                    ( base model, english )
              │                           │
              ▼                           ▼
       ───────────────────────────────────────
                          ▼
                  Segment Timelines
                  (start, end, text)
                          ▼
                400-600 Token Chunks
                (50-100 Token Overlap)
```

---

## 💾 Database Schema

The database tables are automatically bootstrapped on startup (defined in [schema.ts](src/lib/db/schema.ts)):
* **`app_users`**: Durable Clerk account credentials mapping.
* **`videos`**: Relational metadata analytics (follower count, engagement rates, upload date, comments, transcript previews, views, hashtags).
* **`video_chunks`** (or your PGVECTOR table): Stores semantic segment text, start/end times, and the `vector(768)` embedding.
* **`conversations`**: Tracks threads, active user keys, and layout settings with cascade deletions.
* **`conversation_turns`**: Stores message payloads, roles, citation indices, and transcript evidence.

---

## ⚙️ Environment Variables

Prepare a `.env` file containing the following configurations:

```env
# Fastify System Settings
NODE_ENV=development
APP_NAME=social-rag-backend
HOST=0.0.0.0
PORT=5050
LOG_LEVEL=info

# CORS Production Origins (monorepo support)
# Split multiple allowed production domains with a comma
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:3000

# LLM Providers (Hot failover enabled)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.1-flash-lite
GROQ_API_KEY=gsk_...
GEMINI_EMBEDDING_MODEL=gemini-embedding-2

# Relational Vector Database Configs
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

## 🚀 Local Script Execution

### 1. Start Dev Mode (Hot-Reload)
Launches the server in watch mode using `tsx` (TypeScript Execute):
```bash
npm run dev
```

### 2. Build for Production
Compiles all TypeScript source files into optimized JavaScript modules inside `dist/`:
```bash
npm run build
```

### 3. Start Production Server
Starts the compiled JavaScript server via vanilla Node:
```bash
npm run start
```

### 4. Run Compiler Checks
```bash
npm run typecheck
```

---

## 🌐 Production Deployment on Render

When deploying this service on **Render**, configure a **Web Service** with:

### 1. Build and Start Settings
* **Runtime:** `Node`
* **Build Command:** `npm install --include=dev && npm run build` (This tells NPM to temporarily include `devDependencies` during `npm install` even when Render runs in production mode. This makes typescript and type packages like `@types/pg` available to successfully build the project in the `dist/` directory, after which they are pruned automatically for a lightweight container).
* **Start Command:** `npm run start` (Which fires `node dist/server.js` using native optimized Node).

### 2. Automated `yt-dlp` Static Binary Provisioning
* **How it works:** Cloud host environments (like Render's standard Node runtime) do not have the Python-based `yt-dlp` tool pre-installed in the OS.
* **Our Solution:** We integrated an automated curl download directly into the backend `npm run build` script. It automatically pulls the latest `yt-dlp` release binary, places it inside `./bin/yt-dlp`, and grants execution permissions (`chmod a+rx`).
* **Auto-Detection:** The backend's metadata and transcript extraction engine ([yt-dlp-transcript-fetcher.ts](src/lib/transcript/yt-dlp-transcript-fetcher.ts)) dynamically checks for a local `./bin/yt-dlp` executable before falling back to system binaries. This makes video ingestion work completely **out-of-the-box** without needing custom Dockerfiles or system packages!
* **Ignored in Git:** Both local and global `bin/` directories are ignored in `.gitignore` to prevent committing platform-specific binaries into your repository.

### 3. Environment Configurations
* Set `NODE_ENV=production` inside Render Environment variables.
* Set `FRONTEND_ORIGIN` to your production Vercel URL (e.g. `https://creatorlens.vercel.app`).
* Provide Clerk Credentials, Database Connection Strings, and LLM API keys.
* Render's free tier spin-down is handled automatically; the frontend triggers a wakeup health ping immediately when the home page is mounted.
