# Deploy Thrift on a DigitalOcean Droplet

This is the short version for running the full stack (Next.js + OpenClaw scraper) on a single Ubuntu Droplet.

---

**1. Create a Droplet** — Ubuntu 24.04, Basic plan (1–2 GB RAM). Add your SSH key and note the IP.

**2. On the server** — Install Node 20, Docker, PM2, and Git (e.g. nodesource for Node, get.docker.com for Docker, `npm i -g pm2`).

**3. Clone and env**

```bash
cd /root && git clone https://github.com/Fhazara/HackIllinois.git && cd HackIllinois
```

Create root `.env` with `DATABASE_URL`, `MODAL_CHAT_URL`, `MODAL_URL`, `PORT=8080`. Create `docker/.env` with `GEMINI_API_KEY` and `DECODO_TOKEN`.

**4. Start the scraper** — `cd docker && docker compose up -d --build`. Container name: `thrift-product-agent`.

**5. Build and run the app (standalone)**

```bash
cd /root/HackIllinois
npm install && npx prisma generate && npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
cp generated/prisma/libquery_engine-debian-openssl-3.0.x.so.node .next/standalone/.next/server/chunks/
cp .env .next/standalone/.env
cd .next/standalone
PORT=8080 HOSTNAME=0.0.0.0 NODE_OPTIONS="--max-old-space-size=1024" pm2 start server.js --name thrift
pm2 save && pm2 startup
```

**6. Firewall** — Open 8080 and 22: `ufw allow 8080/tcp && ufw allow 22/tcp && ufw --force enable`.

**7. Updates** — After `git pull`: `npm install`, `npx prisma generate`, rebuild, copy `public`, `.next/static`, and the Prisma engine into `.next/standalone` again, then `pm2 restart thrift`.

**Useful** — `pm2 logs thrift`, `pm2 restart thrift`, `docker logs -f thrift-product-agent`.
