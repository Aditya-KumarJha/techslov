# CreatorLens | Next.js Frontend Dashboard

The highly responsive, vibe-coded Next.js + React + Tailwind CSS client dashboard for CreatorLens. It incorporates side-by-side video analytics cards, interactive engagement tracking, full search filters, immediate rename/deletion operations, and a real-time streaming RAG chat panel with citation mapping.

---

## Technical Stack & Features

* **Framework:** **Next.js 16 (App Router)** & **React 19** (designed for modern, modular, and optimized layout routing).
* **Styling & Theme:** **Tailwind CSS v4** & Vanilla CSS variables (incorporating sleek dark modes, vibrant amber highlights, Harmonious Tailwind-based layout grids, and premium responsive cards).
* **Authentication:** **Clerk Providers** (for seamless, secured user log-ins, signup workflows, and private chat history tracking).
* **Key Features:**
  * **Side-by-Side Analytics Cards:** View duration, upload date, views, likes, comments, follower count, engagement rate, and transcript preview.
  * **Interactive Conversation Thread:** Full list of conversations with the ability to delete or rename instantly.
  * **Smart Modal Responsiveness:** Deletion and Rename modal operations are closed immediately in the UI to prevent network lags, while resolving in the background.
  * **Reset States on New Chat:** Instant clearing of chat inputs, search queries, ingestion states, and right-side comparison panels.
  * **Automatic Server Wakeup Ping:** Triggers an immediate wakeup API check on mounting the home page, successfully resolving Render's 50-second free tier cold starts in advance.

---

## Installation & Setup

Ensure you have Node.js 18.x or above installed.

### 1. Install Dependencies
Navigate to the `frontend` directory and install project packages:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root of the `frontend` directory containing:

```env
# Backend API Base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:5050/api/v1

# Clerk Authenticated Session Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c3RpcnJlZC1icmVhbS0zOS5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_DQryB1KTe8mOryURUQr0v6topjcxXVpzKufT8Bqp9G
```

---

## Local Development & Compilation

### 1. Run Development Server
Launches the Next.js development environment on port `5173` (matching the default backend CORS settings):
```bash
npm run dev
```

### 2. Build for Production
Compiles the application into highly optimized production assets:
```bash
npm run build
```

### 3. Run Production Server
Starts the built production bundle:
```bash
npm run start
```

### 4. Code Quality & Typechecking
Verifies type safety and lint contracts:
```bash
npm run lint
```
