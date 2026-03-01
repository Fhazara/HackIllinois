# Deploy Thrift on a DigitalOcean Droplet (with Docker scraper)

Use this when you want the **full flow** (including real product search via Docker/OpenClaw) in production. The Droplet runs both the Next.js app and the scraper container.

---

## 1. Create the Droplet (DigitalOcean)

1. Log in to [DigitalOcean](https://cloud.digitalocean.com).
2. Click **Create** → **Droplets**.
3. **Image:** Choose **Ubuntu 24.04 (LTS)**.
4. **Plan:** **Basic** → **Regular** (e.g. $6/mo 1 GB RAM; $12/mo 2 GB is safer for Node + Docker).
5. **Datacenter:** Pick a region close to you.
6. **Authentication:** **SSH key** (add your Mac’s key if needed: `cat ~/.ssh/id_rsa.pub` or `id_ed25519.pub`).
7. **Hostname:** e.g. `thrift-app`.
8. Click **Create Droplet**. Note the **IP address** (e.g. `164.92.xxx.xxx`).

---

## 2. SSH in and prepare the server

From your Mac:

```bash
ssh root@YOUR_DROPLET_IP
```

(Replace `YOUR_DROPLET_IP` with the IP from step 1.)

Then run:

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker root

# Install PM2 (keeps the app running after you disconnect)
npm install -g pm2

# Install Git if not present
apt install -y git
```

---

## 3. Clone the repo and add env files

Still as `root` on the Droplet:

```bash
cd /root
git clone https://github.com/Fhazara/HackIllinois.git
cd HackIllinois
```

Create the **root** `.env` (Next.js + Modal + DB):

```bash
nano .env
```

Paste (use your real values):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
MODAL_CHAT_URL="https://fhazara05--product-research-llm-chat.modal.run"
MODAL_URL="https://fhazara05--product-image-gen-generate.modal.run"
PORT=8080
```

Save: `Ctrl+O`, Enter, then `Ctrl+X`.

Create the **Docker** env (OpenClaw / Decodo):

```bash
nano docker/.env
```

Paste (use your real keys):

```env
OPENAI_API_KEY=your-openai-key
DECODO_TOKEN=your-decodo-token
```

Save and exit.

---

## 4. Start the scraper container

On the Droplet:

```bash
cd /root/HackIllinois/docker
docker compose up -d --build
```

Check that the container is running and named `thrift-product-agent`:

```bash
docker ps
```

You should see `thrift-product-agent` in the list.

---

## 5. Build and run the Next.js app

```bash
cd /root/HackIllinois

# Install dependencies
npm install

# Generate Prisma client (needs DATABASE_URL in .env)
npx prisma generate

# Optional: push schema if you use the DB
# npx prisma db push

# Build for production
npm run build

# Run with PM2 so it survives SSH disconnect; listen on PORT from .env
PORT=8080 pm2 start npm --name thrift -- start

# Save PM2 process list so it restarts on reboot
pm2 save
pm2 startup
# Run the command it prints (usually something like: env PATH=... pm2 startup systemd -u root --hp /root)
```

---

## 6. Open port 8080 on the Droplet

DigitalOcean may have a firewall. Open port 8080:

```bash
# If UFW is active:
ufw allow 8080/tcp
ufw allow 22/tcp
ufw --force enable
ufw status
```

In the DigitalOcean control panel: **Networking** → **Firewalls** (if you use one) → add an **Inbound** rule for **Port 8080** (TCP), and keep **22** for SSH.

---

## 7. Test the app

In your browser:

- **App:** `http://YOUR_DROPLET_IP:8080`
- Home page → search → confirm → results should run the real scraper (Docker) and show real listings.

---

## 8. Useful commands on the Droplet

| Task | Command |
|------|--------|
| View app logs | `pm2 logs thrift` |
| Restart app | `pm2 restart thrift` |
| Stop app | `pm2 stop thrift` |
| Scraper logs | `docker logs -f thrift-product-agent` |
| Restart scraper | `cd /root/HackIllinois/docker && docker compose restart` |

---

## 9. Deploy updates (after you push to GitHub)

SSH into the Droplet, then:

```bash
cd /root/HackIllinois
git pull origin main
npm install
npx prisma generate
npm run build
pm2 restart thrift
```

If only the Docker skill changed:

```bash
cd /root/HackIllinois/docker
docker compose up -d --build
```

---

## Optional: custom domain and HTTPS

1. Point a domain A record to the Droplet IP.
2. On the Droplet install Nginx and use it as a reverse proxy to `localhost:8080`, and add SSL with Let’s Encrypt (e.g. `certbot`).

If you want, we can add exact Nginx + Certbot steps in a follow-up.
