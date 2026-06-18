# Saul — Better Call Your Hottest Lead First

A lead-prioritization console for edtech sales floors. Saul turns raw masterclass registrant activity into a defensible, explainable priority queue — and arms the caller for the conversation.

---

## The Problem

The company runs free masterclasses that pull in huge numbers of registrants, then a tele-sales floor (BDAs) converts those registrants into paid course enrolments. The daily bottleneck: **which of hundreds of leads to call first, and what to say.**

Existing CRMs use a single additive activity score — a blunt instrument that conflates "who they are" (fit) with "how interested they are" (intent), provides no explainability, and ignores unstructured signals like live chat questions about EMI plans or career outcomes.

## The Solution

Saul implements a **two-dimensional fit × intent scoring model** — 2026 best practice over the single-sum approach — with an **LLM layer that extracts buying signals from unstructured chat/Q&A** and feeds them into a transparent, auditable score.

A BDA logs in and sees **one screen**: their assigned leads, ranked by how worth-calling-right-now they are, each with:

- A plain-language **"why this score"** breakdown (every signal, every point)
- An **AI call-prep brief** — what to talk about, likely objections, and how to handle them
- A **one-tap outreach draft** — WhatsApp / email / SMS, in English / Hindi / Hinglish

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@saul.demo` | `admin123` |
| Sales Lead | `lead@saul.demo` | `lead123` |
| BDA (Be10X) | `bda1@saul.demo` | `bda123` |
| BDA (Office Master) | `bda2@saul.demo` | `bda123` |

BDAs are scoped to different projects — log in as each to see the access boundary in action.

---

## Design Decisions & Trade-offs

### Fit × Intent over a single score

A classic CRM sums all activity into one number. That conflates a senior professional who registered but hasn't engaged (high fit, low intent → nurture) with a student who watched the whole session (low fit, high intent → qualify). The two-axis model surfaces this distinction and routes leads to the right action: call now, qualify, nurture, or deprioritize.

The band assignment uses quadrant logic:

| | High Intent | Low Intent |
|---|---|---|
| **High Fit** | Call Now | Nurture |
| **Low Fit** | Qualify | Cold |

### LLM as extractor, not scorer (collaborator pattern)

The LLM **never** outputs a score or priority. It extracts structured buying signals (`asked_emi`, `price_objection`, `high_enthusiasm`, etc.) from unstructured chat text, validated against a strict Zod enum schema. The deterministic scoring engine then weights those signals like any other activity. This keeps scores auditable and reproducible — the same inputs always produce the same output.

### Explainability as a first-class feature

Every score comes with a `contributions[]` array: which signal fired, its category (fit/intent/negative), its weight, and how many points it added. The UI renders this directly — no black box. This is the thing a floor manager needs to trust the tool.

### Calibration over prediction

A true predictive/ML layer needs ~200–1,000+ clean closed-deal records. A demo doesn't have that. We ship the explainable rules base + LLM-signal layer and include a calibration chart (conversion rate by score band) that proves higher bands actually convert more. The README and UI document exactly where an ML layer would slot in once real conversion history accumulates. Building a confident ML model on seeded data would be confident-looking nonsense.

### AI as optional, not load-bearing

If the AI key is missing or a call fails: the queue, scoring (on structured signals), dispositions, and analytics all keep working. AI panels show a clear "unavailable" state with retry. The app is fully usable with AI switched off.

### Prompt-injection guard

Lead chat is untrusted user-generated text. The extractor treats all lead text strictly as data to analyze (never as instructions), delimits the untrusted block in the prompt, and relies on the Zod enum schema to reject any output that isn't a valid signal type. The seed data includes an injection-attempt message to demonstrate this.

---

## Architecture

```
/app
  /(auth)/login              # Auth.js v5 credentials + JWT
  /(app)
    /queue                   # BDA priority queue (north-star screen)
    /leads/[id]              # Lead detail: score breakdown, AI brief, drafts, timeline
    /analytics               # Funnel + calibration charts (PPR)
    /admin                   # Projects, users, versioned scoring weights
  /api/ai                    # extract / brief / draft (rate-limited)

/lib
  /scoring                   # Pure scoring engine — no I/O, no LLM, no DB
  /ai                        # AI SDK wrappers + Zod schemas
  /db                        # Mongoose singleton + models
  /auth                      # Auth.js config + RBAC helpers
  /validation                # Zod schemas for all inputs
```

**Key constraint:** `lib/scoring` imports nothing from DB or AI layers. Scoring is a pure function of `(lead, activities, extractedSignals, config)` — deterministic, idempotent, and heavily unit-tested.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) | RSC by default, `use cache`/PPR for analytics |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui | Accessible primitives (Radix), design tokens |
| Database | MongoDB Atlas (M0) + Mongoose | Flexible schema for varied lead/activity shapes |
| Validation | Zod | Runtime validation at every boundary |
| Auth | Auth.js v5 (NextAuth) | Credentials + JWT + 3-role RBAC server-side |
| AI | Vercel AI SDK + Gemini Flash / Groq | `generateObject` + Zod for typed LLM output |
| Rate limiting | Upstash Redis | AI and auth route protection |
| Charts | Recharts | Funnel + calibration visualization |
| Testing | Vitest + Playwright | Unit (scoring engine), integration (RBAC), e2e |
| CI/CD | GitHub Actions + Vercel | Lint + typecheck + test on PR; auto-deploy from main |

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB Atlas connection string (or local MongoDB)
- (Optional) AI provider API key (Gemini or Groq)

### Setup

```bash
git clone https://github.com/thepranaygupta/better-call-saul.git
cd better-call-saul
npm install
cp .env.example .env.local
# Fill in MONGODB_URI, AUTH_SECRET, and optionally GOOGLE_GENERATIVE_AI_API_KEY
```

### Seed the database

```bash
npm run seed
```

Creates 3–4 projects, masterclasses, a few hundred leads with realistic distributions, demo users, and varied activity/chat data including an injection-attempt message.

### Run

```bash
npm run dev        # http://localhost:3000 (Turbopack)
npm run build      # Production build
npm run typecheck  # TypeScript strict
npm run lint       # ESLint
npm run test       # Vitest
npm run test:e2e   # Playwright
```

---

## Testing Strategy

**Unit tests (highest ROI):** The scoring engine — disqualifier overrides, missing signals, time-decay, quadrant→band thresholds, idempotency, contributions completeness.

**Integration tests:** RBAC boundary (BDA cannot read another project's lead), Zod validation rejecting bad/extra input.

**E2E (Playwright):** Log in as BDA → open top-priority lead → generate brief/draft → log disposition → verify analytics update.

---

## Real-World Considerations

**Scaling.** At production volume (thousands of leads rescored on new activity), move scoring to a background job queue (e.g., BullMQ) rather than inline on page load. The pure-function design makes this a deployment change, not an architecture change.

**Caching.** AI-generated briefs and drafts are cached per lead — regenerated only on explicit request or new disposition. Scoring configs are cached at the project level. User-specific lead data is never cached (`use cache` applies only to the analytics shell).

**Observability.** Structured API errors that leak no stack traces. In production: Sentry for error tracking, OpenTelemetry for request tracing, Mongo connection pool monitoring.

**PII & India DPDP Act.** This demo uses synthetic data. In production: lead PII (name, email, phone) requires explicit consent and purpose limitation under the Digital Personal Data Protection Act, 2023. Data retention policies, right-to-erasure workflows, and encryption at rest would be mandatory. The audit log provides the access trail.

**Prior art.** The company uses an established CRM (per public job postings / BuiltWith). Saul is a from-scratch 2026 fit×intent + LLM-augmented take focused on explainability and the unstructured-signal layer a classic CRM doesn't cover — built to demonstrate the approach, not to replace their stack.

---

---

<p align="center">
  Built by <a href="https://github.com/thepranaygupta"><strong>Pranay Gupta</strong></a> · <a href="https://linkedin.com/in/thepranaygupta">LinkedIn</a>
</p>
