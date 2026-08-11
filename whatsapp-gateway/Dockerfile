FROM node:20-bookworm-slim

# O Baileys baixa libsignal diretamente do GitHub. A imagem slim não inclui git.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git python3 make g++ \
  && git config --system url."https://github.com/".insteadOf "ssh://git@github.com/" \
  && git config --system url."https://github.com/".insteadOf "git@github.com:" \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional

COPY server.js ./

ENV NODE_ENV=production
ENV PORT=3847

EXPOSE 3847

CMD ["node", "server.js"]
