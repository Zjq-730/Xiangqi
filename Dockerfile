# Stage 1: Build Linux Pikafish NNUE engine (supports both amd64 & arm64 cloud hosts)
FROM debian:bookworm-slim AS pikafish-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ make git curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build
RUN git clone --depth 1 https://github.com/official-pikafish/Pikafish.git pikafish-src
WORKDIR /build/pikafish-src/src
RUN ARCH=$(case "$(uname -m)" in \
      x86_64) echo "x86-64-modern" ;; \
      aarch64|arm64) echo "armv8" ;; \
      *) echo "general-64" ;; \
    esac) \
  && make -j"$(nproc)" build ARCH="$ARCH"

# Stage 2: Build React + Vite frontend
FROM node:22-slim AS web-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN npm run build

# Stage 3: Minimal production runtime
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PIKAFISH_THREADS=2
ENV PIKAFISH_HASH=32

COPY --from=web-builder /app/dist ./dist
COPY --from=web-builder /app/server/prodServer.mjs ./server/prodServer.mjs
COPY --from=pikafish-builder /build/pikafish-src/src/pikafish ./engine-bin/pikafish
COPY --from=pikafish-builder /build/pikafish-src/src/pikafish.nnue ./engine-bin/pikafish.nnue

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/prodServer.mjs"]
