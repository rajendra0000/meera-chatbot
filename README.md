# Hey Concrete Conversational AI Backend

Production-oriented backend for a sales chatbot used by Hey Concrete. The system combines deterministic conversation orchestration with LLM-assisted intent understanding and tone polishing, while keeping business truth, flow control, and safety in the backend.

This is not a prompt-only chatbot. It is a modular Node.js service designed for lead capture, product discovery, FAQ handling, handoff to humans, and WhatsApp delivery through Gupshup.

## Overview

The assistant, Meera, guides users through a structured qualification journey:

- captures sales leads conversationally
- supports out-of-order user inputs
- answers FAQs without losing flow
- recommends grounded catalog products
- escalates to a human when intent or lead quality justifies it
- continues responding even after handoff without dead-ending the thread

The backend is built to feel conversational while remaining deterministic where it matters.

## Core Flow

High-level request lifecycle:

```text
User
  -> Intent classification (LLM Call 1 + deterministic fallback)
  -> Backend truth layer (state, extraction, routing, control decisions)
  -> Response rewrite (LLM Call 2, tone-only)
  -> Validator (anti-hallucination + anti-repetition)
  -> Final output
```

System flow in practice:

```text
User message
  -> Safety inspection
  -> Intent classification
  -> Entity extraction
  -> State transition
  -> FAQ / product / handover / purchase routing
  -> Backend-approved reply
  -> Tone rewrite
  -> Reply validation
  -> Persist conversation + messages + lead updates
```

## Architecture

The backend uses a service-based modular architecture. The orchestration lives in one place, but each responsibility is isolated and testable.

### Key Services

#### `ConversationService`

The central orchestrator.

- loads the active conversation
- applies safety and handover checks
- runs intent classification and extraction
- computes state transitions
- invokes FAQ, showroom, product, and response logic
- persists messages and conversation state transactionally
- supports optimistic retries on conversation write conflicts

#### `IntentService`

Classifies the latest user message into backend-usable intents.

- uses Groq JSON completion for classification
- falls back deterministically when the LLM is unavailable
- detects purchase intent, product switching, FAQ, vague replies, greetings, and safety-sensitive cases

#### `EntityExtractorService`

Extracts structured fields from user input.

- captures fields such as `name`, `productType`, `city`, `budget`, `areaSqft`, `roomType`, `style`, and `timeline`
- supports out-of-order field capture
- normalizes values before they touch conversation state
- includes strict city extraction to avoid state corruption from phrases like `in a few months`

#### `ResponseService`

Builds the assistant’s reply in two layers.

- first creates the backend-approved reply that contains the real intent and flow decision
- then optionally calls the tone layer to rewrite only phrasing
- attaches quick replies only when appropriate
- keeps control-turn replies deterministic for product/image/handover paths

#### `ResponseValidatorService`

Safety net for LLM-polished replies.

- blocks hallucinated or unsupported facts
- rejects repeated questions or stale acknowledgements
- preserves the backend-approved meaning and next-step question
- falls back to the deterministic approved reply when polish is unsafe

#### `HandoverService`

Controls human escalation behavior.

- detects explicit escalation language
- supports stronger handover intent handling for natural phrases
- works with post-handoff mode so the chatbot can still help after escalation

#### `ProductService`

Grounded product recommendation and browsing logic.

- recommends catalog-backed products only
- supports `show products`, `more options`, and `more images`
- keeps category locking intact
- prevents unsupported image/gallery claims

### Supporting Components

- `StateMachineService`: computes the next step from collected data
- `SafetyService`: blocks prompt injection, spam, and empty-input cases
- `ChannelRendererService`: adapts output shape for channel clients
- Prisma repositories: encapsulate conversations, messages, leads, FAQs, products, and showrooms

## What Makes This Backend Strong

### Conversational Intelligence

- Out-of-order input handling: users can answer later questions early and the backend still stores usable fields.
- Interrupt handling: FAQ, image requests, product switching, and browsing interrupts can override the active collection step safely.
- Context awareness: recent conversation history is used during response phrasing and validation.
- No repetitive questioning: the backend avoids re-asking already captured fields and blocks stale rewrites.

### Human-like UX

- Logic and personality are separated: the backend decides what to say, the tone layer decides how to say it.
- Replies stay short, WhatsApp-friendly, and less robotic.
- Post-handoff conversations remain natural instead of locking users into a dead loop.

### Robust Flow Engine

- Flow progression is data-driven via `collectedData`, not only by the current step.
- Required fields are checked centrally before advancing.
- FAQ step locking prevents the bot from drifting to the next step during collection.
- Fallbacks exist when LLM classification is unavailable.

### Safety Layer

- Validator blocks hallucinated polish and unsupported numeric/showroom claims.
- Deterministic control paths are used for high-risk states like handover and media flows.
- Prompt injection and data exfiltration attempts are intercepted before they affect downstream logic.

### Handoff System

- Human escalation is supported through intent and phrase-based triggers.
- Qualified or purchase-ready leads can escalate naturally.
- After handoff, the conversation can still handle product or FAQ follow-ups without resetting the thread.

### WhatsApp Readiness

- Dedicated Gupshup webhook endpoint
- HMAC signature verification
- outbound message helper for Gupshup delivery
- deployable on Railway as a production backend

### Reliability Improvements

Recent backend hardening includes:

- strict city extraction instead of greedy free-text parsing
- FAQ step locking during collection
- proper `400` validation responses for bad API requests
- improved escalation phrase handling
- expanded regression coverage for real conversational failures

## Conversation Flow

Primary qualification sequence:

```text
Name -> Product Type -> City -> Budget -> Area -> Room Type -> Style -> Timeline -> Recommendations
```

Important behavior:

- users can answer fields out of order
- structured steps are progressed from missing data, not only from turn order
- FAQ can interrupt the flow, but the pending step remains locked
- product browsing and image requests can interrupt the flow without corrupting state

## API

### `POST /chat`

Primary endpoint for web chat or direct backend testing.

#### Request

```json
{
  "conversationId": "optional-conversation-id",
  "message": "Hi, I want wall panels in Delhi",
  "bootstrap": false,
  "channel": "WEB",
  "contactId": "optional-user-id"
}
```

All fields are optional at schema level, but practical usage is:

- `message` for a normal turn
- `bootstrap: true` to start a new greeting turn
- `conversationId` to continue an existing thread
- `channel` to label the source (`WEB`, `GUPSHUP`, `SANDBOX`)

#### Success Response

```json
{
  "conversationId": "conv_123",
  "replyText": "I am Meera from Hey Concrete.\nWhat should I call you?",
  "recommend_products": [],
  "recommendProducts": [],
  "isMoreImages": false,
  "isBrowseOnly": false,
  "quickReplies": [],
  "handover": false,
  "triggerType": null,
  "promptVersionId": 12,
  "promptVersionLabel": "v12 · Learning",
  "nextStep": "NAME",
  "collectedData": {},
  "lead": null
}
```

#### Validation Error

Bad payloads return `400`:

```json
{
  "error": "Invalid request",
  "details": [
    {
      "code": "invalid_type",
      "path": ["bootstrap"],
      "message": "Expected boolean, received string"
    }
  ]
}
```

### `POST /webhook/gupshup`

Inbound WhatsApp webhook for Gupshup.

#### Expected Payload

```json
{
  "payload": {
    "type": "text",
    "source": "919999999999",
    "payload": {
      "text": "Hi"
    },
    "sender": {
      "name": "Test User"
    }
  }
}
```

#### Headers

- `Content-Type: application/json`
- `x-gupshup-signature: <hex-hmac-signature>`

The signature is:

```text
hex(HMAC_SHA256(GUPSHUP_WEBHOOK_SECRET, raw_request_body))
```

#### Success Response

```json
{
  "ok": true,
  "result": {
    "conversationId": "conv_123",
    "replyText": "Hi, I’m Meera from Hey Concrete...",
    "handover": false
  }
}
```

#### Unauthorized Response

```json
{
  "error": "Invalid webhook signature"
}
```

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd "New project"
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Create `.env`

Use `backend/.env.example` as the template:

```env
DATABASE_URL="postgresql://user:password@host:port/heyconcrete?sslmode=require"

ADMIN_API_KEY=

GROQ_API_KEY=your_groq_api_key_primary
GROQ_API_KEY_2=your_groq_api_key_secondary
GROQ_API_KEY_3=your_groq_api_key_tertiary
GROQ_API_KEY_4=your_groq_api_key_quaternary
GROQ_API_KEY_5=your_groq_api_key_quinary

PORT=3001
FRONTEND_URL="http://localhost:5173"

GUPSHUP_API_KEY=your_gupshup_api_key
GUPSHUP_APP_NAME=your_app_name
GUPSHUP_SOURCE_NUMBER=91XXXXXXXXXX
GUPSHUP_BASE_URL=https://api.gupshup.io/wa/api/v1/msg
GUPSHUP_WEBHOOK_SECRET=your_webhook_hmac_secret
```

### 4. Prepare the database

```bash
npm run prisma:generate
npx prisma migrate deploy
```

If you are working from a fresh local database and want catalog/demo data:

```bash
npm run seed
```

### 5. Run locally

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

The backend starts on `http://localhost:3001` by default.

## Deployment

This project is designed for hosted deployment.

Current infrastructure model:

- Backend: Railway
- Database: PostgreSQL via Neon
- Frontend: separate app, typically Vercel
- WhatsApp transport: Gupshup

Deployment notes:

- set all env vars in Railway Variables
- keep `GUPSHUP_WEBHOOK_SECRET` consistent between Gupshup and backend
- point Gupshup webhook to `/webhook/gupshup`
- use `/health` for service checks

## Testing

Run the backend test suite:

```bash
cd backend
npm test
```

The project currently includes roughly 90+ backend tests covering:

- intent and fallback behavior
- FAQ and flow locking
- city extraction and normalization
- handover behavior
- anti-hallucination response validation
- product recommendation and image flows
- adversarial inputs and prompt injection
- concurrency and optimistic retry behavior
- lead scoring
- controller validation responses

The test suite is intentionally focused on conversation reliability, not just unit-level helpers.

## Demo / Manual Testing

### Test via `/chat`

Use this when you want to test the chatbot directly without webhook signing.

```bash
curl --location 'http://localhost:3001/chat' \
--header 'Content-Type: application/json' \
--data-raw '{
  "message": "Hi, I want wall panels in Delhi",
  "channel": "WEB"
}'
```

### Test via Postman

Recommended for local evaluation:

1. Create a `POST` request to `/chat`
2. Set `Content-Type: application/json`
3. Use a raw JSON body
4. Start with a simple message like:

```json
{
  "message": "Hi",
  "channel": "WEB"
}
```

Then continue the same conversation by reusing the returned `conversationId`.

### Test via Gupshup webhook

Webhook testing requires signature generation.

Example cURL:

```bash
curl --location 'http://localhost:3001/webhook/gupshup' \
--header 'Content-Type: application/json' \
--header 'x-gupshup-signature: <generated-hex-hmac>' \
--data-raw '{
  "payload": {
    "type": "text",
    "source": "919999999999",
    "payload": {
      "text": "Hi"
    },
    "sender": {
      "name": "Test User"
    }
  }
}'
```

For Postman, the `x-gupshup-signature` must be generated from the exact raw body string. Sending the secret itself as the header will fail.

## Engineering Decisions

### Why 2 LLM calls instead of 1?

Because control and personality are different problems.

Call 1 is used for intent understanding:

- classify the user’s message
- extract structured signal
- help the backend understand what happened

Call 2 is used only for phrasing:

- rewrite the backend-approved reply
- make it sound more natural
- avoid letting the LLM decide business truth

This separation keeps the backend reliable while still allowing human-like responses.

### Why deterministic backend + LLM tone separation?

Because sales chatbots fail in production when the model owns state.

The backend is the source of truth for:

- current step
- collected data
- recommendation logic
- handover state
- FAQ locking
- product/image control paths

The model is allowed to help with interpretation and tone, but not with core business control.

### Why add a validator layer?

Because even a good tone rewrite can:

- add unsupported facts
- change the next question
- repeat the last assistant turn
- produce vague filler instead of a useful reply

The validator makes the system robust by rejecting unsafe rewrites and falling back to the deterministic approved reply.

### Why not build this as a full agentic system?

A sales chatbot like this needs consistency more than autonomy.

Agentic systems are powerful, but for structured lead capture they introduce unnecessary risk:

- harder to predict flow behavior
- harder to keep state stable
- easier to hallucinate unsupported catalog or policy details
- harder to test exhaustively

This backend chooses controlled orchestration over open-ended autonomy, which is the right tradeoff for production sales support.

## Future Improvements

- Rich WhatsApp media cards and interactive product selection
- vector search / RAG for broader grounded FAQ and catalog retrieval
- conversation analytics dashboard for funnel drop-off and handover quality
- deeper prompt/version observability
- multilingual evaluation and monitoring

## Project Structure

High-level backend layout:

```text
backend/
  src/
    chat/
      controllers/
      repositories/
      services/
      types/
      utils/
      validators/
    controllers/
    routes/
    services/
    helpers/
    lib/
  prisma/
  tests/
```

## Summary

This backend is designed to demonstrate engineering depth in conversational systems:

- LLM-assisted, but backend-governed
- modular and testable
- grounded for real catalog and FAQ usage
- safe against common conversational failures
- ready for web chat and WhatsApp-style delivery

It is intentionally built like a production service, not a prototype prompt wrapper.
