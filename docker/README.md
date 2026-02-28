# Thrift Product Search Agent 🦞

Docker container running **OpenClaw** with **GPT 5.0** and **Decodo Web Scraping** to find second-hand products across multiple marketplaces.

## Quick Start

### 1. Set up credentials

```bash
cp .env.example .env
```

Edit `.env` and fill in your API keys:
- **OpenAI API Key** — get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Decodo credentials** — sign up at [decodo.com](https://decodo.com), get username/password from the Dashboard → Scraper tab

### 2. Build and run

```bash
docker compose up -d --build
```

### 3. Verify

```bash
# Check the container is running
docker compose ps

# Check health
curl http://localhost:18789/api/v1/health

# Open the Control UI
open http://localhost:18789/
```

### 4. Test a search

From the Thrift Next.js app (running on `localhost:3000`):

```bash
curl -X POST http://localhost:3000/api/agent-search \
  -H "Content-Type: application/json" \
  -d '{"query": "vintage Levi 501 jeans", "budget": 75}'
```

Or interact directly with the agent via the OpenClaw Control UI at `http://localhost:18789/`.

## Architecture

```
User → Next.js (/api/agent-search) → OpenClaw Agent → GPT 5.0
                                          ↓
                                    search.py (skill)
                                          ↓
                                   Decodo Scraping API
                                          ↓
                              eBay · Depop · Poshmark
                              Etsy · Craigslist · FB Marketplace
```

## Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Node 22 + Python 3 + OpenClaw + scraping deps |
| `docker-compose.yml` | Container orchestration with health checks |
| `.env.example` | API key template |
| `config/config.json` | OpenClaw model + agent config |
| `skills/product-search/SKILL.md` | Agent skill instructions |
| `skills/product-search/search.py` | Decodo scraping script |

## Useful Commands

```bash
# Stop the agent
docker compose down

# View logs
docker compose logs -f openclaw-agent

# Rebuild after changes
docker compose up -d --build

# Shell into the container
docker compose exec openclaw-agent bash
```
