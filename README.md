# Hey Concrete Hiring Challenge

Production-style monorepo for the Hey Concrete chatbot challenge using Node.js 20, Express, TypeScript, Prisma, SQLite, React 18, Vite, TailwindCSS, and Groq.

## Tech Stack

- Backend: Node.js 20, Express, TypeScript, Prisma, SQLite, Groq SDK
- Frontend: React 18, Vite, TailwindCSS
- Database: SQLite via Prisma
- Channels: Web chat, Admin sandbox, Gupshup-ready webhook

## Architecture

- `frontend` renders three surfaces: customer chat, lead dashboard, and admin sandbox.
- `backend` owns products, showrooms, prompt versions, conversations, messages, leads, and lead score breakdowns.
- Every chat request loads the active `SYSTEM` + `LEARNING` prompts, advances the strict 9-step flow, asks Groq for structured JSON, persists messages, calculates score, and updates hot-lead state.
- Gupshup webhook traffic uses the exact same chat service as the web UI.

## Day 1 - How To Run Locally And Test Full 9-Step Conversation

1. Install dependencies from the repo root:

```bash
npm install
```

2. Copy environment files:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

3. Add your keys:

- `backend/.env`: add `GROQ_API_KEY`
- Optional for WhatsApp readiness: add Gupshup keys

4. Prepare the database:

```bash
npm run prisma:generate --workspace backend
npm run prisma:push --workspace backend
npm run seed --workspace backend
```

5. Start both apps:

```bash
npm run dev
```

6. Open:

- Chat: `http://localhost:5173/`
- Dashboard: `http://localhost:5173/dashboard`
- Admin Sandbox: `http://localhost:5173/admin/sandbox`

7. Test the 9-step flow:

- Start the chat and confirm greeting from Meera
- Answer in order: name, product type, city, budget, area, room type, style, timeline
- Confirm product cards appear after recommendations
- Confirm dashboard updates with score, status, breakdown, and conversation history

## Day 2 Notes

- After running `prisma db push` and seeding, the dashboard is wired for the requested columns, filters, stats, export actions, demo leads, and hot-lead handover logic.
- The workspace did not include the five screenshots, so the dashboard and modal are implemented in the requested dark premium structure and may still need screenshot-based spacing/color tuning for true pixel-identical matching.

## Self-Learning System

- Open `/admin/sandbox`
- Use the sandbox chat on the left
- Add a correction on the right, for example: `Instead of "Sure", say "Kyo nahi"`
- Save correction to create a new active `LEARNING` prompt version
- Start a fresh sandbox conversation to verify the new tone applies instantly
- Use `Rollback` in version history to reactivate an older learning prompt

## Follow-Up System

The 5-layer follow-up architecture is fully implemented:
- Layer generation with context-aware messages per lead
- Dashboard trigger with preview modal and copy buttons
- Lead status transitions (WARM → HOT → DORMANT)

**Note on automation:** Automated scheduling (node-cron or similar) is architected but not activated in this submission. The system is production-ready for scheduling - add a cron job calling the follow-up endpoint at the configured intervals to activate it.

## Gupshup Integration

1. Set these keys in `backend/.env`:

   - `GUPSHUP_API_KEY`
   - `GUPSHUP_APP_NAME`
   - `GUPSHUP_SOURCE_NUMBER` (your Gupshup sender number, e.g. `919999999999`)
   - `GUPSHUP_BASE_URL=https://api.gupshup.io/wa/api/v1/msg`
   - Optional admin protection: `ADMIN_API_KEY`

2. Paste this webhook URL in your Gupshup console (Messaging → App → Callback URL):

   - `POST https://<your-domain>/webhook/gupshup`

3. Gupshup inbound messages arrive as:

   ```json
   {
     "payload": {
       "type": "text",
       "source": "919876543210",
       "payload": { "text": "Hello" },
       "sender": { "name": "User Name", "phone": "919876543210" }
     }
   }
   ```

   The backend parses this format and routes it into the same chat logic as the web UI.

4. Test locally with ngrok:

   ```bash
   ngrok http 3001
   curl -X POST https://<ngrok-url>/webhook/gupshup \\
     -H "Content-Type: application/json" \\
     -d '{"payload":{"type":"text","source":"919876543210","payload":{"text":"hello"},"sender":{"name":"Test"}}}'
   ```

## How To Deploy On Render (Production)

1. **Database Setup**
   - Create a PostgreSQL database on Render, Supabase, or Neon.
   - Copy the connection string to `DATABASE_URL`.

2. **Backend Web Service Setup**
   - Create a new Web Service on Render connected to this repo.
   - Set Root Directory to `backend`.
   - Build Command: `npm install && npx prisma generate && npx prisma db push && npm run build`
   - Start Command: `npm run start`
   - Add Environment Variables:
     - `DATABASE_URL` (your Postgres connection string)
     - `GROQ_API_KEY` (and backups)
     - `GUPSHUP_WEBHOOK_SECRET` (for webhook HMAC security)

3. **Frontend Static Site Setup**
   - Create a new Static Site on Render.
   - Set Root Directory to `frontend`.
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - Add Environment Variable:
     - `VITE_API_URL=https://<your-backend-domain.onrender.com>`

4. **Prevent Spin-Down (BetterStack)**
   - Render free tier spins down after 15 minutes of inactivity.
   - Create a free account on [BetterStack Uptime](https://betterstack.com/uptime).
   - Add a monitor pointing to your backend: `https://<your-backend-domain.onrender.com>/health`
   - Set the check interval to **every 14 minutes** or less.
   - The `/health` endpoint returns `{status: 'ok', timestamp, uptime}` which BetterStack will verify, keeping your Groq models hot and the backend instantly responsive.

## Demo Script — Exact 2.5-Minute Screen Recording

**0:00 – 0:20** Open `/dashboard`. Show 4 stats at the top.
Click **Load Demo** → 3 hot leads appear: Aakanksha Mehta (97), Priya Sharma (89), Rohan Gupta (77).
Click **View** on Aakanksha → LeadModal opens: score breakdown bars (Budget 30/30, Space 20/20, etc.),
Estimated Order Value ₹1,44,000, full conversation history in chat bubbles.

**0:20 – 0:55** Open `/` (Meera Chat). Type your name → click quick-reply **Wall Panels (H-UHPC)** →
type city → click budget quick-reply **₹400+** → type `250 sqft` → click room-type quick-reply
**Living Room** → click style quick-reply **Minimal** → click timeline quick-reply **This Month**.
Product carousel appears: Serene, Toran, Dune cards with images, dimensions, price badge.

**0:55 – 1:15** Start a fresh chat conversation. Reach the BUDGET step, then type:
`"what about installation costs?"`
Meera answers: *"Installation is done by approved contractors, ₹150-200 per sqft..."*
then redirects back to the budget question — NOT handed over to Kabir.
This proves off-topic FAQ handling and the false-positive handover fix.

**1:15 – 1:45** Open `/admin/sandbox`. Chat once (type your name).
In the **Correct Meera** panel on the right, type:
`Instead of "Sure", always say "Kyo nahi" when agreeing.`
Click **Save As New Learning Version** → version history shows v2 Active.
Click **New Chat** (bootstrap) in the left panel → reply uses "Kyo nahi".
Click **Rollback to v1** → v1 is active again. Both directions work live.

**1:45 – 2:05** Back on `/dashboard` → open any lead modal → click **Export Lead** → CSV downloads.
On the dashboard header, click **Export CSV** → full all-leads CSV downloads.
Click **Trigger Follow-up** in the lead modal → show the 5-layer follow-up message JSON in the response.

**2:05 – 2:30** Show terminal. Run:

```bash
curl -X POST http://localhost:3001/webhook/gupshup \\
  -H "Content-Type: application/json" \\
  -d '{"payload":{"type":"text","source":"919876543210","payload":{"text":"Namaste"},"sender":{"name":"Test"}}}'
```

Response shows `replyText: "Namaste! I'm Meera from Hey Concrete..."` — not skipped.
Say: *"Real WhatsApp messages from Gupshup route through this exact endpoint into the same
9-step state machine, lead scoring engine, and prompt-learning system."*

## ImgBB Replacement Slots

Replace the placeholder `image_url` values in the `products` table with final public ImgBB links for:

- Serene
- Furrow
- Furrow 2.0
- Code
- Code 2.0
- Toran
- Toran 2.0
- Petal
- Dune
- Endless
- Legato
- Ridge
- Matrix
- Tetra
- Crown
- Ashta Prahar
- Shringaar
- Samwad
- Poorak
- Veetraagi
- Abhivyakti
- Gupp
- Katha
- BB-01
- BB-02
- BB-03
- Standard Brick Cladding
