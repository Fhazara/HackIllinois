# Thrift - AI Product Search

An agentic product discovery platform that uses LLMs (Anthropic Claude 3.5 Sonnet) and a custom OpenClaw web scraping agent to find real second-hand and vintage products across the web based on natural language queries.

## Architecture
- **Frontend/Backend:** Next.js (React), storing sessions in `sessionStorage`
- **Conversational LLM UI:** Modal Serverless Python App (`modal/product_research_llm.py`) utilizing Anthropic API.
- **Agentic Scraper:** Containerized OpenClaw instance with the `product-search` skill, utilizing the Decodo scraping API and OpenAI.

## Prerequisites
- Node.js (v20+)
- Docker Dekstop
- Python 3.12+ (for Modal)
- accounts on [Modal](https://modal.com/), Anthropic, OpenAI, and Decodo

## 1. Configure the LLM Chat UI (Modal)

The conversational assistant that extracts requirements from the user is deployed to Modal.

1. Ensure you have the `modal` CLI installed (`pip install modal`) and authenticated (`modal token new`).
2. Add your Anthropic API Key to Modal:
   ```bash
   modal secret create anthropic-secret ANTHROPIC_API_KEY="your-key-here"
   ```
3. Deploy the Modal App:
   ```bash
   modal deploy modal/product_research_llm.py
   ```
4. Copy the deployed ASGI App URL (e.g., `https://your-namespace--product-research-llm-fastapi-app.modal.run`) and paste it into the root `.env` file for **`MODAL_CHAT_URL`**.

## 2. Start the OpenClaw Scraping Agent (Docker)

The agent responsible for actually surfing Etsy, eBay, etc., runs inside a Docker container to ensure its dependencies and the OpenClaw gateway run smoothly.

1. Open the `docker/` directory.
2. Edit `docker/.env` with your API keys:
   ```env
   OPENAI_API_KEY=your-openai-key-here
   DECODO_TOKEN=your-decodo-basic-auth-token-here
   ```
3. Start the Docker container:
   ```bash
   cd docker
   docker compose up -d --build
   ```
4. The OpenClaw scraping agent is now bound to your system's `localhost:18789` and the Next.js API route will execute its python scraper directly using `docker exec`.

## 3. Run the Next.js Frontend

1. Ensure the root `.env` file is properly configured with your database URL, Modal URL, and API keys.
2. Ensure you have pushed the Prisma schema to your database if you want to use the DB for logging (optional for core flow):
   ```bash
   npx prisma generate
   npx prisma db push
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Navigate to `http://localhost:3000` to begin your product search!
