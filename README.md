# Thrift — AI-Powered Second-Hand Product Discovery

An agentic product discovery platform that uses LLMs (Google Gemini 2.5 Flash) and a custom OpenClaw web scraping agent to find real second-hand and vintage products across eBay, Etsy, Depop, Poshmark, and Craigslist — all from a natural language query or uploaded image.

## Architecture

```
User ──► Next.js Frontend ──► Modal LLM ("Omniscient Scout")
              │                      │
              │                      ├── Gemini 2.5 Flash (conversational AI)
              │                      ├── Supermemory (preference memory)
              │                      └── SD 3.5 Large Turbo (reference images)
              │
              ├── OpenClaw Docker Agent ──► Decodo Scraping API
              │       (eBay, Etsy, Depop, Poshmark, Craigslist)
              │
              ├── PostgreSQL + Prisma (subscriptions, seen items)
              │
              └── MailJet (email notifications every 15 min)
```

- **Frontend/Backend:** Next.js 16 (React), session-based conversation state
- **Conversational LLM:** Modal serverless Python app using Gemini 2.5 Flash with image understanding and Supermemory for cross-session preference recall
- **AI Image Generation:** Stable Diffusion 3.5 Large Turbo on Modal A100 GPUs — generates 3 reference images for visual confirmation
- **Agentic Scraper:** Containerized OpenClaw instance with the `product-search` skill, using the Decodo scraping API
- **Notifications:** MailJet transactional emails triggered by a 15-minute cron scheduler

## Prerequisites

- Node.js (v20+)
- Docker Desktop
- Python 3.12+ (for Modal CLI)
- PostgreSQL (local or remote)
- Accounts on [Modal](https://modal.com/), [Google AI Studio](https://aistudio.google.com/) (Gemini), [Decodo](https://decodo.com/), and [MailJet](https://www.mailjet.com/)

## 1. Configure Modal Secrets

The LLM and image generation services run on Modal and require API keys stored as Modal secrets.

```bash
# Install and authenticate Modal CLI
pip install modal
modal token new

# Create required secrets
modal secret create gemini-secret GEMINI_API_KEY="your-gemini-api-key"
modal secret create supermemory-secret SUPERMEMORY_API_KEY="your-supermemory-api-key"
```

## 2. Deploy the LLM Chat (Modal)

The "Omniscient Scout" conversational assistant is deployed to Modal. It handles multi-turn chat, image understanding, and generates 3 distinct reference image prompts.

```bash
modal deploy modal/product_research_llm.py
```

Copy the printed URL (e.g., `https://your-namespace--product-research-llm-chat.modal.run`) and set it as `MODAL_CHAT_URL` in the root `.env` file.

## 3. Deploy AI Image Generation (Modal)

The reference image generator uses Stable Diffusion 3.5 Large Turbo on A100 GPUs.

```bash
modal deploy modal/image_gen_modal.py
```

Copy the printed URL and set it as `MODAL_URL` in the root `.env` file.

## 4. Start the OpenClaw Scraping Agent (Docker)

The agent responsible for searching eBay, Etsy, Depop, Poshmark, and Craigslist runs inside a Docker container.

1. Edit `docker/.env` with your API keys:
   ```env
   OPENAI_API_KEY=your-openai-key-here
   DECODO_TOKEN=your-decodo-basic-auth-token-here
   ```
2. Start the Docker container:
   ```bash
   cd docker
   docker compose up -d --build
   ```

The scraping agent binds to `localhost:18789` and the Next.js API executes its Python scraper directly via `docker exec`.

## 5. Set Up the Database

```bash
# Generate the Prisma client
npx prisma generate

# Push the schema to your PostgreSQL database
npx prisma db push
```

## 6. Configure Environment Variables

Edit the root `.env` file with your URLs and keys:

```env
DATABASE_URL="postgresql://user@localhost:5432/thrift?schema=public"
MODAL_URL="https://your-namespace--product-image-gen-generate.modal.run"
MODAL_CHAT_URL="https://your-namespace--product-research-llm-chat.modal.run"
GEMINI_API_KEY="your-gemini-api-key"
MAILJET_SENDER_EMAIL="your-verified-mailjet-sender@email.com"
```

## 7. Run the Next.js Frontend

```bash
npm install
npm run dev
```

Navigate to `http://localhost:3000` to begin your product search!

## 8. Run the Notification Scheduler (Optional)

Users can subscribe to email alerts that fire every 15 minutes when new matching listings are scraped.

**Option A — Modal Cron (Production):**
```bash
modal deploy modal/alert_cron.py
```

**Option B — Local Development:**
The cron API endpoint can be triggered manually:
```bash
curl http://localhost:3000/api/alerts/cron
```

> **Note:** Ensure both the Next.js server and Docker container are running. The sender email must be verified in your [MailJet dashboard](https://app.mailjet.com/account/sender).

## Key Features

| Feature | Description |
|---|---|
| **Natural Language Search** | Describe what you want; the AI asks follow-up questions to refine |
| **Image Upload** | Upload a photo and the AI identifies the product to search for |
| **AI Reference Images** | 3 distinct Stable Diffusion reference images for visual confirmation |
| **Multi-Marketplace** | Searches eBay, Etsy, Depop, Poshmark, and Craigslist simultaneously |
| **Smart Notifications** | Email alerts every 15 min for new matching listings |
| **Preference Memory** | Supermemory remembers what to avoid across sessions |

## Tech Stack

Next.js · React · TypeScript · Python · Gemini 2.5 Flash · Stable Diffusion 3.5 · Modal · PostgreSQL · Prisma · Docker · MailJet · Decodo · OpenClaw · Supermemory
