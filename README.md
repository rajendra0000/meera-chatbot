# Hey Concrete AI Chatbot

Production-ready AI chatbot system for Hey Concrete. The assistant, Meera, is designed for high-intent lead capture over conversational interfaces, with a backend that combines deterministic business logic, LLM reasoning, persistent conversation state, and operational safeguards required for real customer traffic.

The system is deployed and structured for production use. It captures leads conversationally, recommends relevant products such as wall panels and breeze blocks, scores lead quality in real time, and escalates qualified or purchase-ready conversations for human follow-up. The backend is channel-agnostic and already shaped for WhatsApp delivery through a Gupshup-ready webhook architecture.

## 1. Project Overview

Meera is an AI sales assistant for Hey Concrete that guides customers through a structured qualification flow without feeling form-driven.

- Collects leads through natural, WhatsApp-style conversation
- Recommends products across wall panels, breeze blocks, brick cladding, wall murals, and related categories
- Tracks user intent, captured entities, and conversation state across multiple turns
- Scores lead quality continuously and triggers handover when qualification or purchase intent crosses the right threshold
- Supports web chat today and WhatsApp integration through a Gupshup-compatible backend flow

This repository is not a demo chatbot. It is a production-oriented lead acquisition system with persistent data, channel abstraction, guardrails, and test coverage around critical flows.

## 2. Key Features

### Conversational Lead Capture

- Guides users through a structured qualification journey without exposing internal forms
- Collects name, product interest, city, budget, area, room type, style, and timeline in sequence
- Maintains a one-question-per-step interaction model to reduce drop-off and improve answer quality

### Deterministic + LLM Hybrid Pipeline

- Uses deterministic extraction and state rules for control-critical decisions
- Uses Groq-backed LLM calls for intent classification and response phrasing
- Prevents the model from owning business state directly; the backend remains the source of truth

### Product Recommendation Engine

- Maps collected preferences to relevant product categories and curated recommendations
- Supports follow-up browsing flows such as more products and more images
- Avoids hallucinated catalog suggestions by grounding responses in database-backed product records

### Lead Scoring System

- Scores each lead across budget fit, project area, product/design interest, urgency, and engagement quality
- Produces a transparent breakdown rather than a single opaque score
- Drives downstream lead status and handover triggers

### Purchase Intent Detection and Showroom Routing

- Detects explicit buying signals, callback requests, and handover language
- Routes showroom-related queries using stored location data
- Escalates qualified leads without waiting for the full flow when intent is strong enough

### Self-Learning System

- Separates stable system behavior from evolving business tone and correction rules
- Supports active learning prompt versions stored in the database
- Allows admin corrections to change assistant behavior without redeploying the application

### Adversarial Safety Handling

- Detects prompt injection, data exfiltration attempts, spam, empty inputs, and unsafe probing
- Applies policy flags before intent classification and response generation
- Keeps the assistant grounded to approved product and FAQ context

### Optimistic Concurrency Handling

- Protects conversation updates with version-aware writes
- Retries safely on write conflicts and transient Prisma transaction failures
- Prevents double-commit behavior under concurrent message delivery scenarios

### Multi-turn Context Awareness

- Uses recent message history, collected fields, current step, and prompt versions together
- Handles off-topic FAQs without losing progress in the qualification flow
- Supports post-recommendation updates when users change product or budget preferences mid-conversation

## 3. Architecture Overview

The backend is organized around clear service boundaries so orchestration, extraction, state management, recommendation, and safety are independently testable.

- `conversation.service`: central orchestrator for message processing, persistence, retries, and final response assembly
- `intent.service`: classifies incoming messages into step answers, FAQs, handover requests, browsing requests, and other conversational intents
- `entity-extractor.service`: extracts and normalizes structured fields such as city, budget, area, style, and product type
- `state-machine.service`: advances or holds the user in the correct step based on collected data and intent
- `product.service`: selects relevant products, handles recommendation refreshes, and supports browse/more-images flows
- `response.service`: builds the final assistant reply using grounded context and channel-aware rendering
- `safety.service`: blocks or flags adversarial inputs before they influence downstream logic
- `repositories`: encapsulate persistence for conversations, messages, leads, products, FAQs, and showrooms

High-level flow:

`User -> Intent -> Extraction -> State -> Response -> DB`

Operationally, each message is processed as follows:

1. Load the active conversation and prompt bundle.
2. Inspect the message for safety and handover signals.
3. Classify intent and extract structured updates.
4. Transition the conversation state machine.
5. Generate grounded recommendations or FAQ answers when needed.
6. Persist conversation, message history, and lead updates transactionally.

## 4. Conversation Flow

The qualification flow is intentionally strict and optimized for messaging UX:

`Name -> Product -> City -> Budget -> Area -> Room -> Style -> Timeline -> Recommendations -> Purchase / Handover`

Design principles:

- One-question-per-step to keep the interaction lightweight and easy to answer
- WhatsApp-style conversational replies instead of form-like prompts
- Quick replies for high-friction decisions such as product category, budget, room type, style, and timeline
- FAQ handling that answers the user while returning them to the pending qualification step
- Recommendation delivery only after enough context has been captured to make suggestions meaningful

## 5. Lead Scoring System

Lead quality is computed as a weighted score out of 100:

- Budget Alignment: 30
- Area: 20
- Design Interest: 15
- Timeline: 10
- Engagement: 25

Scoring behavior:

- Budget alignment is category-aware rather than globally fixed
- Area rewards commercially meaningful project sizes
- Design interest reflects whether the user has provided enough product/design specificity
- Timeline prioritizes urgent projects
- Engagement increases with substantive answers, product browsing, image requests, and recommendation behavior

Qualification rules:

- Score `>= 70` -> `HOT` lead -> eligible for handover
- Score `40-69` -> `WARM` lead
- Score `< 40` -> `COLD` lead

Additional handover triggers:

- Explicit callback or team handover request
- Strong purchase intent
- Showroom or visit-oriented buying behavior

## 6. Tech Stack

### Backend

- Node.js
- TypeScript
- Express
- Prisma
- PostgreSQL (Neon)

### AI

- Groq API

### Infra

- Railway (backend)
- Vercel (frontend)

## 7. Deployment

Production deployment is split by runtime responsibility:

- Backend deployed on Railway
- Frontend deployed on Vercel
- PostgreSQL hosted on Neon

Required environment variables include:

```env
DATABASE_URL=
GROQ_API_KEY=
GROQ_API_KEY_2=
GROQ_API_KEY_3=
GROQ_API_KEY_4=
GROQ_API_KEY_5=
PORT=3001
FRONTEND_URL=
ADMIN_API_KEY=
GUPSHUP_API_KEY=
GUPSHUP_APP_NAME=
GUPSHUP_SOURCE_NUMBER=
GUPSHUP_BASE_URL=https://api.gupshup.io/wa/api/v1/msg
GUPSHUP_WEBHOOK_SECRET=
VITE_API_URL=
```

Deployment notes:

- Backend exposes `/chat`, `/dashboard`, `/admin`, `/webhook`, and `/health`
- Admin and dashboard routes can be protected with `ADMIN_API_KEY`
- WhatsApp webhook traffic is processed through the same orchestration pipeline as web chat

## 8. Running Locally

From the repository root:

```bash
git clone <repo-url>
cd "New project"
```

Backend setup:

```bash
cd backend
npm install
```

Create `backend/.env` and configure the required variables:

```env
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
GROQ_API_KEY=your_primary_key
PORT=3001
FRONTEND_URL=http://localhost:5173
```

Generate Prisma client and apply schema:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the backend in development:

```bash
npm run dev
```

Production-style local start:

```bash
npm run build
npm start
```

Frontend setup:

```bash
cd ..\\frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
```

Run the frontend:

```bash
npm run dev
```

## 9. Testing

The backend includes targeted coverage for the highest-risk parts of the system:

- Adversarial test suite for prompt injection, hallucination boundaries, flow integrity, and security-sensitive behavior
- Flow tests for multi-step qualification logic
- Lead scoring tests for weighted scoring correctness and status thresholds
- Concurrency tests for optimistic retries and transaction conflict handling

The current backend test command is:

```bash
cd backend
npm test
```

`npm test` passes in this repository.

## 10. Self-Learning System

This is one of the core differentiators of the project.

The chatbot separates long-lived orchestration logic from adaptable conversational behavior:

- A Knowledge Base grounds factual responses in approved FAQ and product context
- A Learning Prompt stores evolving behavioral corrections independently from the system prompt
- Admin corrections create new active learning versions in the database
- New behavior can be activated immediately without a code redeploy
- Rollback is supported by switching the active learning version

This design allows business teams to refine tone, phrasing, and corrective behavior while preserving deterministic backend guarantees around state, scoring, and safety.

## 11. Screenshots / Demo

Suggested GitHub assets for this section:

- Chat UI
- Product recommendation carousel
- Lead dashboard
- Admin correction / learning interface

Add screenshots or a short demo link here when publishing externally.

## 12. Future Improvements

- Complete full WhatsApp production rollout via Gupshup
- Improve recommendation personalization using historical conversion signals
- Add deeper analytics for funnel drop-off, conversion quality, and handover efficiency
- Extend the assistant to voice and voice-to-text assisted interactions

## 13. Author

- Technical hiring task submission for Hey Concrete
- Contact: add candidate email or LinkedIn here before publishing
