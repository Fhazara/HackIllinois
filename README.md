# Thrift

# AI-Powered Second-Hand Product Discovery

## Inspiration

We wanted to make finding second-hand and vintage stuff feel like asking a friend who actually knows where to look. Instead of opening five tabs and repeating the same search everywhere, you describe what you want — or upload a photo — and get real listings from eBay, Etsy, Depop, Poshmark, and Craigslist in one place. We combined an AI chat that refines your search with an agent that runs the scrapes and brought in preference memory so it remembers what you’re not into.

---

## What It Does

* You type or speak what you’re looking for (e.g. “vintage Levi 501s under $50” or “mid-century desk lamp”). The AI asks follow-up questions when it needs to narrow things down.
* You can upload a photo instead; the app figures out what to search for from the image.
* We generate a few reference images (Stable Diffusion on Modal) so you can confirm we’re on the right track before digging into results.
* An OpenClaw agent in Docker calls the Decodo API and returns live listings from the marketplaces above.
* Optional email alerts every 15 minutes when new matching listings show up.
* Supermemory stores your preferences across sessions so we don’t keep suggesting stuff you’ve already passed on.

**Workflow:**

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      USER                               │
                    │         (query or image → refine → confirm)              │
                    └─────────────────────────┬───────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Next.js (Frontend + API)                                             │
│  session state · image upload · /api/agent-search · /api/alerts · Prisma (subscriptions, seen)   │
└───┬─────────────────────┬─────────────────────┬─────────────────────┬───────────────────────────┘
    │                     │                     │                     │
    ▼                     ▼                     ▼                     ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────────┐  ┌─────────────────┐
│ Modal (chat)  │  │ Modal (imgs)  │  │ OpenClaw (Docker)  │  │ MailJet + cron   │
│ Gemini +      │  │ SD 3.5 Turbo  │  │ product-search     │  │ 15-min alerts    │
│ Supermemory   │  │ 3 ref images  │  │ skill → Decodo API │  │                  │
└───────────────┘  └───────────────┘  └─────────┬─────────┘  └─────────────────┘
                                                  │
                                                  ▼
                                    eBay · Etsy · Depop · Poshmark · Craigslist · FB Marketplace
```

---

## How We Built It

* **Frontend & API:** Next.js 16 (React, TypeScript), session-based conversation state, image upload passed into the first message.
* **Conversational AI:** A Modal serverless app using Google Gemini 2.5 Flash for multi-turn chat and image understanding, with Supermemory for cross-session preference recall.
* **Reference images:** Stable Diffusion 3.5 Large Turbo on Modal A100 GPUs — we generate three distinct reference images per search.
* **Product search:** A containerized OpenClaw instance with a custom `product-search` skill that calls the Decodo scraping API to hit eBay, Etsy, Depop, Poshmark, Craigslist, and Facebook Marketplace.
* **Data:** PostgreSQL and Prisma for subscriptions and seen items; MailJet for transactional emails; a 15-minute cron (Modal or Next.js API) to send alert digests.

---

## Challenges We Ran Into

* **Cross-platform Prisma engine:** The app is built on a Mac but deployed on a Linux Droplet. Prisma’s query engine is platform-specific, so we had to add `debian-openssl-3.0.x` to the schema’s binary targets and copy the Linux engine into the Next.js standalone output (`.next/standalone/.next/server/chunks/`) so the deployed app could load it.
* **Next.js 16 + standalone:** Making sure `public` and `.next/static` were correctly copied into the standalone build and that the server ran reliably under PM2 with limited memory took some iteration.
* **Coordinating three runtimes:** Keeping the Next.js app, the Modal endpoints (chat + image gen), and the OpenClaw Docker agent in sync for local dev and production required clear env docs and a minimal deploy checklist.

---

## Accomplishments That We're Proud Of

* End-to-end flow: natural language or image → AI refinement → real multi-marketplace results → optional email alerts.
* Integrating Gemini (multimodal), Supermemory, OpenClaw, and Decodo into a single coherent product experience.
* A deployable standalone build on a small DigitalOcean Droplet with the scraper running in Docker alongside the app.
* Preference memory that actually carries across sessions so repeat users get smarter suggestions.

---

## What We Learned

* How Prisma’s binary targets and standalone output interact when building on one OS and deploying on another.
* Practical use of agentic workflows (OpenClaw skills + Decodo) for real-world scraping and how to expose that cleanly through a Next.js API.
* Balancing Modal serverless (great for bursty LLM and image workloads) with a long-lived Docker agent for scraping.

---

## What's Next

* Support for more marketplaces and filters (condition, location, seller rating).
* Richer alert preferences (frequency, price range, keywords).
* Optional vector search or embeddings to improve “find similar” and recommendations.

---

## Try It Out

**Live app:** [Add your live URL here, e.g. http://174.138.93.147:8080]

**Run locally:** Node 20+, Docker, Python 3.12+ (Modal), PostgreSQL. Clone the repo, add `.env` (see root and `docker/`) with `DATABASE_URL`, `MODAL_CHAT_URL`, `MODAL_URL`, `GEMINI_API_KEY`, `DECODO_TOKEN`, `MAILJET_SENDER_EMAIL`. Then: `npm install` → deploy Modal apps (`modal deploy modal/product_research_llm.py`, `modal deploy modal/image_gen_modal.py`) → `cd docker && docker compose up -d --build` → `npx prisma generate && npx prisma db push` → `npm run dev`. Open [http://localhost:3000](http://localhost:3000). Full steps are in the repo; server deploy is in [docs/DROPLET_DEPLOY.md](docs/DROPLET_DEPLOY.md).

---

## Built With

* Next.js
* React
* TypeScript
* Prisma
* PostgreSQL
* Google Gemini
* Modal
* OpenClaw
* Decodo
* MailJet
* Supermemory
* Stable Diffusion (via Modal)
