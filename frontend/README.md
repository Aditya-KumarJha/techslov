# CreatorLens Client | Next.js RAG Dashboard

The state-of-the-art, vibe-coded, and highly responsive Next.js frontend client dashboard for CreatorLens. Engineered with React 19, Tailwind CSS v4, and Clerk, this client provides side-by-side video metrics breakdowns, optimistic UI state updates, automatic backend wakeup pings, and sub-second token streaming.

---

## 🎨 Premium Design System & UX Highlights

We built the CreatorLens interface to feel like a premium, state-of-the-art creator studio, focusing on visual excellence, snappiness, and zero friction:

### 1. Tailwind CSS v4 & Harmonic Glassmorphism
* **The Design:** Implements modern typography (Outfit / Geist), harmonized dark palettes (steep carbon tones), smooth gradients, subtle micro-animations, and glassmorphic card grids.
* **Responsive Layout:** Responsive columns that scale from dynamic single-column mobile views to optimized three-column layouts (`[Sidebar_History | Main_Ingest_Chat | Sidebar_Analytics]`) on large screens.

### 2. Active Server Warmup (Cold-Start Resolution)
* **The Optimization:** Since Render's free tier spins down backends after 15 minutes of inactivity, waiting for a user query to wake up the server causes a ~50-second lag.
* **The Solution:** Added a lightweight mount `useEffect` inside [social-rag-dashboard.tsx](src/components/social-rag-dashboard.tsx) that fires a non-blocking `GET` request to the backend's `/health` endpoint the millisecond the frontend loads. This wakes up the server in the background while the user is still pasting URLs or reading the welcome text!

### 3. Immediate Modal Responsive Operations
* **The Optimization:** Waiting for network responses to close dialogs causes visual stutter and makes applications feel laggy.
* **The Solution:** Deletion and Rename actions close their respective modals and clear state IDs **instantly** (within ~1ms). The API call then resolves in the background, updating the sidebar list asynchronously. If a network block or error occurs, the transient red warning notification banner appears automatically.

### 4. Smart Reset Counter keys
* **The Optimization:** When starting a "New Chat", elements in the DOM (such as input URLs or statistics panels) should reset completely. 
* **The Solution:** Implemented a `resetFormKey` integer state that increments on clicking "New chat". By keying the `IngestForm` with this key (`key={`${conversationId || "new-chat"}-${resetFormKey}`}`), React completely unmounts and remounts a fresh, empty form, resetting all inputs in a single render frame.

---

## 🏗️ Folder Structure

```
src/
├── app/                    # Next.js App Router root layout and globals
├── components/             # Reusable UI dashboard elements
│   ├── chat-panel.tsx      # Real-time streaming conversation log
│   ├── citation-list.tsx   # Semantic source timeline mappings
│   ├── ingest-form.tsx     # Double-input URL validator and submitter
│   ├── social-rag-dashboard.tsx # Master state coordinator
│   ├── ui-icons.tsx        # Optimized, custom SVG icons
│   ├── video-card.tsx      # Video stats card (Views, Likes, Followers, Engagement)
│   └── ...
├── lib/
│   ├── api.ts              # Core fetch connectors and Fastify empty body delete handlers
│   └── format.ts           # Metric numbering and timeline formatting helpers
└── types/                  # Shareable TypeScript contracts
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root of the `frontend` directory containing:

```env
# Backend API Base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:5050/api/v1

# Clerk Authentication Session Credentials
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c3RpcnJlZC1icmVhbS0zOS5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_DQryB1KTe8mOryURUQr0v6topjcxXVpzKufT8Bqp9G
```

---

## 🚀 Execution Scripts

### 1. Run Development Server
Launches the development client on port `5173` (matching the default backend CORS origin settings):
```bash
npm run dev
```

### 2. Build for Production
Compiles the application into optimized, static, and server-side production bundles:
```bash
npm run build
```

### 3. Run Production Server
Launches the built production bundle:
```bash
npm run start
```

### 4. Lint and Code Quality
Checks for formatting and syntax contracts:
```bash
npm run lint
```

---

## 🌐 Production Deployment on Vercel

When deploying this frontend on **Vercel**, select the project directory and configure:

### 1. Build and Framework Settings
* **Framework Preset:** `Next.js`
* **Build Command:** `next build`

### 2. Environment Variables
* Configure `NEXT_PUBLIC_API_BASE_URL` to point to your production Render Fastify URL.
* Supply your Clerk publishable key (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) and secret key (`CLERK_SECRET_KEY`).
* All communication and dynamic cross-site CORS queries between Vercel and Render are fully managed and allowed dynamically in production!
