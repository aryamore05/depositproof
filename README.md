# DepositProof

**Document it before. Prove it later.**

DepositProof helps tenants — especially students and people in shared accommodation — document the condition of a rental property before moving in and compare it with its condition when moving out. It turns scattered phone photos into an organized, dated property-condition record with AI-assisted observations and a printable evidence report.

Built for Hacktoberfest 2026's open-source AI challenge. Open-source AI is a core feature, not a bolt-on chatbot.

---

## Problem

Tenants take photos when moving in, but the evidence gets scattered across phone galleries, messaging apps, and folders. They forget which photos belong to which room, when they reported existing damage, or what changed during their stay. DepositProof organizes all of this into a single dated record.

**What DepositProof is NOT:** It never promises guaranteed deposit recovery, never determines legal liability, and never claims AI findings are definitive proof.

---

## Features

- **Dashboard** — overview of properties, active rentals, open maintenance issues, and recent activity.
- **Property management** — create rental records with type, dates, and landlord contact; add rooms (bedroom, bathroom, kitchen, living room, balcony, other).
- **Photo evidence** — upload JPEG/PNG/WebP photos per room, tag with condition stage (move-in / maintenance / move-out), damage category, and descriptions. Capture date and upload date are stored separately and clearly distinguished.
- **Room condition checklist** — 8-item default checklist per room (walls, doors, windows, floor, lights, furniture, water leakage, cleanliness) with statuses: good, existing damage, needs attention, not inspected. Inspection progress bar per room.
- **AI-powered photo analysis** — sends photos to a configurable Ollama vision-language model (default `llava:7b`) that returns a structured description, suggested damage category, observations, and confidence/uncertainty. Users review and accept or edit before saving. Never fabricates results.
- **Maintenance log** — record issues with room, description, date reported, and status (reported → acknowledged → in-progress → resolved / unresolved). Full status-change history is retained.
- **Move-out inspection** — side-by-side move-in vs move-out photo comparison per room. Does not auto-conclude tenant caused damage.
- **Evidence timeline** — chronological feed of photos, checklist updates, maintenance, and move-out events, filterable by event type.
- **PDF evidence report** — downloadable report with property details, room checklists, photos with descriptions and dates, maintenance history, AI observations (clearly labeled), and completeness notes. Marked as not legally conclusive.
- **Evidence completeness checklist** — actionable suggestions for missing documentation (rooms without photos, damage without descriptions, stale maintenance, move-out not done). Not a legal score.
- **AI connection status** — explicit Connected / Disconnected / Checking / Unavailable states. Manual documentation works fully when AI is offline.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Frontend (React + TypeScript + Vite + Tailwind) │
│  - Hash-based router, sidebar layout             │
│  - Service layer (src/lib/api.ts)                │
│  - Supabase JS client for data + storage         │
└───────────────┬──────────────────┬───────────────┘
                │                  │
                ▼                  ▼
   ┌────────────────────┐  ┌──────────────────────┐
   │  Supabase Postgres │  │  Supabase Storage    │
   │  (properties,      │  │  (property-photos    │
   │   rooms, photos,   │  │   bucket, UUID paths)│
   │   checklist,       │  └──────────────────────┘
   │   maintenance,     │
   │   settings)        │
   └────────────────────┘
                │
                ▼
   ┌────────────────────────────────┐
   │  Supabase Edge Function        │
   │  /functions/v1/analyze-photo   │
   │  - Reads AI config from DB     │
   │  - Proxies to Ollama           │
   │  - Honest unavailable states   │
   └───────────────┬────────────────┘
                   ▼
          ┌─────────────────┐
          │  Ollama (local) │
          │  llava:7b or    │
          │  any vision LLM │
          └─────────────────┘
```

**Why a Supabase Edge Function?** The hosted frontend cannot reach a developer's `localhost` directly. The edge function reads the configured Ollama URL from the `app_settings` table and proxies the request. If the URL is empty or unreachable, it returns an explicit `ai_unavailable` status — no fake results.

---

## Technology stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Icons | lucide-react |
| PDF | jsPDF |
| Dates | date-fns |
| Database | Supabase Postgres |
| File storage | Supabase Storage |
| AI proxy | Supabase Edge Function (Deno) |
| Vision model | Ollama + llava:7b (or any Ollama-compatible vision model) |

---

## Installation

### Prerequisites

- Node.js 18+
- An Ollama installation (only needed for AI features — manual documentation works without it)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

The app uses a pre-provisioned Supabase instance. Connection details are in `.env` and don't need manual configuration.

### Production build

```bash
npm run build
npm run preview
```

---

## Configuring Ollama and the vision model

### Windows setup

1. **Install Ollama** — download from [ollama.com](https://ollama.com) and run the installer.

2. **Pull a vision model** (open a Command Prompt or PowerShell):
   ```powershell
   ollama pull llava:7b
   ```
   Other compatible models: `llama3.2-vision`, `moondream`.

3. **Allow cross-origin requests** so the edge function can reach Ollama. Set the `OLLAMA_ORIGINS` environment variable before starting Ollama:
   - **Command Prompt:**
     ```cmd
     set OLLAMA_ORIGINS=*
     ollama serve
     ```
   - **PowerShell:**
     ```powershell
     $env:OLLAMA_ORIGINS="*"
     ollama serve
     ```

4. **Find your computer's reachable URL.** If Ollama runs on your Windows machine, it listens on `http://localhost:11434` locally. For a hosted frontend to reach it, you need a URL the browser can access — either:
   - Run the frontend locally too (so `localhost` works for both), or
   - Expose Ollama via a tunnel (e.g. `ngrok http 11434`) and use the tunnel URL.

5. **Configure in the app** — open DepositProof, go to **Settings**, enter:
   - **Ollama backend URL:** `http://localhost:11434` (local) or your tunnel URL
   - **Vision model name:** `llava:7b` (or whichever you pulled)
   - Click **Save settings**, then **Test connection**.

### macOS / Linux setup

```bash
ollama pull llava:7b
OLLAMA_ORIGINS="*" ollama serve
```

Then configure the backend URL in Settings as above.

---

## Environment variables

The app's Supabase credentials are pre-populated. The AI configuration lives in the database (`app_settings` table) and is edited through the Settings page — not environment variables — so you can change it at runtime.

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (pre-set) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (pre-set) |
| `SUPABASE_URL` | Used by the edge function (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Used by the edge function (server-side) |

AI settings (stored in DB, edited via Settings UI):

| Key | Default | Purpose |
|-----|---------|---------|
| `ai_backend_url` | (empty) | Ollama URL, e.g. `http://localhost:11434` |
| `ai_model` | `llava:7b` | Vision model name |
| `ai_enabled` | `true` | Show/hide AI analysis buttons |

---

## API endpoints

The frontend talks to Supabase directly (Postgres + Storage) and to one edge function:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/functions/v1/analyze-photo` | POST | Proxy image to Ollama, return structured JSON |

The edge function accepts `{ imageUrl, description?, model? }` and returns:
- `{ status: "ok", model, result: { description, suggested_category, observations, confidence, uncertainty } }` on success
- `{ status: "ai_unavailable" | "ai_disabled" | "ai_error", message }` on failure

Database tables: `properties`, `rooms`, `photos`, `checklist_items`, `maintenance_issues`, `maintenance_updates`, `app_settings`.

---

## Privacy considerations

- Photos are stored in the project's Supabase Storage bucket, not a third-party image host.
- AI analysis sends an image only to the Ollama URL you configure. No other external AI provider is called.
- File types are validated (JPEG, PNG, WebP) and size is capped at 15 MB.
- Files are stored under server-generated UUID paths, never user-supplied filenames.
- This MVP is single-tenant (no sign-in). Don't store sensitive photos in a shared deployment.
- Local inference with Ollama means your photos never leave your machine if you run both the frontend and Ollama locally.

---

## Limitations and future improvements

**Current limitations:**
- Single-tenant (no authentication). Multi-user isolation is a future improvement.
- AI cannot determine the age or cause of damage, identify who caused it, verify legal responsibility, or certify image authenticity.
- Capture date extraction uses file `lastModified` and is marked unreliable. Full EXIF parsing is a future improvement.
- The PDF report is text-based (no embedded images yet).
- No move-out AI comparison suggestions yet — the comparison view is manual side-by-side.

**Future improvements:**
- Supabase Auth for multi-user isolation.
- EXIF-based capture date extraction for reliable timestamps.
- Embedded photos in the PDF report.
- AI-suggested move-in vs move-out change detection (clearly labeled as suggestions).
- PWA support for offline capture and sync.
- Multi-language support.

---

## License

This project does not currently include a license file. Add an appropriate open-source license (e.g. MIT, Apache-2.0) before publishing to a public repository.
