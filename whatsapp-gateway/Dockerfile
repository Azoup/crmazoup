FROM node:20-bookworm-slim

# Dependências de build (alguns pacotes do Baileys podem precisar)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV NODE_ENV=production

EXPOSE 3847

CMD ["node", "server.js"]
