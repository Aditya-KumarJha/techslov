# CreatorLens | Social RAG Studio

CreatorLens is an advanced, high-performance, vibe-coded **Social Media Video Comparison RAG Assistant**. Designed for modern content creators, it allows side-by-side performance analysis, hook comparisons, style evaluation, and audience engagement comparison of **YouTube Videos** and **Instagram Reels** through an intuitive, real-time streaming chat interface.

## Project Screenshots & Demos

Below are demonstration screenshots showing the CreatorLens dashboard in action:

![CreatorLens Dashboard Ingest & Chat](frontend/public/demo/demo-1.png)

*Figure 1: CreatorLens side-by-side video analytics cards and real-time streaming RAG conversation thread.*

![CreatorLens Deep Analysis & Citations](frontend/public/demo/demo-2.png)

*Figure 2: Comprehensive citation mapping and transcript evidence tracking during comparison analysis.*

---

## Key Features

1. **Dual Ingestion (YouTube & Instagram Reels):** Accept a YouTube URL and an Instagram Reel URL to instantly pull video transcripts and rich metadata (views, likes, comments, creator details, follower counts, hashtags, duration, etc.).
2. **Dynamic Engagement Metrics:** Automatically compute engagement rates using the industry-standard formula:
   $$\text{Engagement Rate} = \frac{\text{Likes} + \text{Comments}}{\text{Views}} \times 100$$
3. **Chunking & Vector Storage:** Efficiently chunk transcripts and generate high-fidelity embeddings stored in **pgvector** or **Qdrant** with robust `video_id` metadata tagging (`A` and `B`).
4. **Streaming RAG Pipeline:** Converse with an advanced LangGraph agent that performs context-aware comparisons, remembers conversational history, streams tokens with near-zero latency, and fallback-checks API keys.
5. **Detailed Source Citations:** Every assistant answer is backed by precise evidence citations mapping directly back to video segments, transcript timelines, and source metadata.
6. **Robust UX Optimizations:**
   * Immediate, responsive modals for conversation renaming and permanent deletion.
   * Smart state clearing (clearing search filters, chat inputs, ingestion states, and right-side statistics panel cards on "New Chat" click).
   * **Active Server Warmup:** On loading the landing page, the client automatically triggers an immediate wakeup ping to eliminate Render free-tier cold starts (50-second wake times).
   * **Cross-Site Production CORS:** Configured with dynamic, robust CORS support for seamless multi-origin communication in production (Render backend + Vercel frontend).

---

## Repository Structure

The project is organized as a monorepo containing the following components:

```
├── backend/            # Fastify backend, database models, LangGraph engine, and ingest pipelines
├── frontend/           # Next.js web application and beautiful vibe-coded dashboard
├── LICENSE             # MIT License
└── README.md           # Root repository documentation
```

To learn more about each individual layer, please refer to their respective documentation files:
* 💻 **Backend Guide:** [backend/README.md](file:///Users/adityakumarjha/Desktop/internship/backend/README.md)
* 🎨 **Frontend Guide:** [frontend/README.md](file:///Users/adityakumarjha/Desktop/internship/frontend/README.md)

---

## Quick Start (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/Aditya-KumarJha/techslov.git
cd techslov
```

### 2. Run the Fastify Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables inside a `.env` file (see [backend/README.md](file:///Users/adityakumarjha/Desktop/internship/backend/README.md) for full parameters):
   ```env
   PORT=5050
   GEMINI_API_KEY=your_gemini_api_key
   GROQ_API_KEY=your_groq_api_key
   DATABASE_URL=postgresql://your_db_credentials
   CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   ```
4. Run the backend development server:
   ```bash
   npm run dev
   ```

### 3. Run the Next.js Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` file containing Clerk configuration (see [frontend/README.md](file:///Users/adityakumarjha/Desktop/internship/frontend/README.md)):
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:5050/api/v1
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   ```
4. Run the frontend development server:
   ```bash
   npm run dev
   ```
5. Open your browser to `http://localhost:5173`.

---

## Monorepo Production Deployment

### 1. Backend on Render
* **Build Command:** `npm run build`
* **Start Command:** `npm run start`
* **Environment Configuration:**
  * Add your `DATABASE_URL` (pgvector postgresql db), `GEMINI_API_KEY`, `GROQ_API_KEY`, `CLERK_SECRET_KEY`, and `CLERK_PUBLISHABLE_KEY`.
  * Set `FRONTEND_ORIGIN` to your Vercel production domain url (e.g., `https://your-app.vercel.app`).
  * Render free tier spin-down is handled automatically on user mount via frontend automatic health-ping wakeup hooks.

### 2. Frontend on Vercel
* **Framework Preset:** Next.js
* **Build Command:** `next build`
* **Environment Configuration:**
  * Set `NEXT_PUBLIC_API_BASE_URL` to your production Render backend URL (e.g., `https://your-backend.onrender.com/api/v1`).
  * Configure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

---

## License

This project is licensed under the [MIT License](LICENSE).
