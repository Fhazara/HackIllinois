# Thrift Scraper (OpenClaw + Decodo)

This container is the **product-search** leg of Thrift: it runs the OpenClaw agent that hits the Decodo API and returns live listings from eBay, Etsy, Depop, Poshmark, Craigslist, and Facebook Marketplace. The Next.js app calls it when a user confirms their search.

**Setup**

1. Copy `.env.example` to `.env` (or create `.env`).
2. Set `GEMINI_API_KEY` (Google AI Studio) and `DECODO_TOKEN` (decodo.com dashboard).
3. Run:

```bash
docker compose up -d --build
```

The agent listens on `localhost:18789`. The main app invokes it via `docker exec`; you can also use the OpenClaw UI at http://localhost:18789/ to test searches by hand.

**Useful commands**

* Logs: `docker compose logs -f openclaw-agent`
* Stop: `docker compose down`
