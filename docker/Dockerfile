# ─────────────────────────────────────────────────────────────
#  Thrift Product Search Agent
#  OpenClaw + GPT 5.0 + Decodo Web Scraping
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

# System deps: Python 3 (for the search skill script) + useful CLI tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    curl git ca-certificates jq socat \
    && rm -rf /var/lib/apt/lists/*

# Create a Python venv so pip installs don't conflict with system packages
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python deps for the product search skill
RUN pip install --no-cache-dir requests beautifulsoup4

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Create the openclaw user workspace directories
RUN mkdir -p /home/node/.openclaw/workspace/skills \
    && mkdir -p /home/node/.openclaw/config \
    && chown -R node:node /home/node

# Copy the product search skill into the workspace
COPY --chown=node:node skills/ /home/node/.openclaw/workspace/skills/

# Copy the OpenClaw config (model + skill settings)
COPY --chown=node:node config/ /home/node/.openclaw/config/

# Switch to non-root user
USER node
WORKDIR /home/node

# OpenClaw gateway port
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -sf http://localhost:18789/api/v1/health || exit 1

# Start socat forwarding 0.0.0.0:18789 -> 127.0.0.1:18790, and start openclaw on 18790
CMD socat TCP-LISTEN:18789,fork,bind=0.0.0.0 TCP:127.0.0.1:18790 & openclaw gateway --port 18790 --allow-unconfigured
