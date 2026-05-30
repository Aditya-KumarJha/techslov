# Social RAG Backend

Node.js + TypeScript backend scaffold for the social video RAG challenge.

## Why this structure

- Fastify for low-overhead HTTP handling and streaming support.
- TypeScript for predictable contracts around transcripts, metadata, chunks, and chat responses.
- LangChain and LangGraph kept behind a dedicated `lib` layer so the orchestration can evolve without rewriting routes.
- Gemini is the default hosted model path, with `GEMINI_API_KEY` and `gemini-3.5-flash`-style models replacing the old OpenAI setup.
- Postgres is the durable source of truth for jobs, conversations, videos, and transcript chunks, with pgvector handling semantic retrieval.

## Planned backend responsibilities

- Ingest one YouTube URL and one Instagram Reels URL.
- Fetch transcript and metadata for each video.
- Chunk and embed transcript text.
- Store chunks in the vector layer with `videoId` tagging.
- Serve a streaming RAG chat API with citations and conversational memory.
- Expose clean health and video metadata endpoints for the frontend.
- Keep ingest job history and chat history queryable through read endpoints.

## Folder layout

- `src/server.ts` - process bootstrap.
- `src/app.ts` - Fastify instance, plugins, route registration, and error handlers.
- `src/config/` - environment and runtime config.
- `src/routes/` - top-level route registration.
- `src/modules/` - business domains split by feature.
- `src/lib/` - transcript, embedding, vector store, and RAG adapters.
- `src/lib/db/` - database pool and schema bootstrap.
- `src/lib/state/` - durable app state for jobs, conversations, and videos.
- `src/middlewares/` - request and error handling.
- `src/types/` - shared API types.

## Next implementation slices

1. Build the ingestion pipeline.
2. Add transcript adapters for YouTube and Instagram.
3. Wire embeddings and the vector store.
4. Add streaming chat with source citations.
5. Add the React frontend on top of these APIs.
