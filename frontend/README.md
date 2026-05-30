# Social RAG Frontend

Next.js frontend for the social video RAG challenge.

## Local setup

1. Copy `.env.example` to `.env.local` and set the backend URL if needed.
2. Start the backend on `http://localhost:3000`.
3. Run the frontend:

```bash
npm run dev
```

The app runs on [http://localhost:5173](http://localhost:5173) so it matches the backend CORS origin.

## What it does

- Ingests one YouTube URL and one Instagram Reel URL.
- Loads video metadata and transcript previews for both videos.
- Streams chat answers from the backend with citations.
- Keeps the conversation ID in the browser so follow-up questions stay in context.

## Environment

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:5050/api/v1`

