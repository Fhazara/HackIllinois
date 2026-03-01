#!/usr/bin/env bash
# Copy the Prisma Query Engine (Linux) into the Next.js standalone server chunks
# so the bundled app can find it at runtime. Run this on the deployment server
# after copying generated/prisma and before starting the standalone server.
set -e
ROOT="${1:-.}"
STANDALONE="$ROOT/.next/standalone"
CHUNKS="$STANDALONE/.next/server/chunks"
ENGINE_NAME="libquery_engine-debian-openssl-3.0.x.so.node"
SOURCE="$ROOT/generated/prisma/$ENGINE_NAME"
if [ ! -f "$SOURCE" ]; then
  echo "Error: $SOURCE not found. Run 'npx prisma generate' on this machine first."
  exit 1
fi
mkdir -p "$CHUNKS"
cp "$SOURCE" "$CHUNKS/"
echo "Copied $ENGINE_NAME to $CHUNKS"
