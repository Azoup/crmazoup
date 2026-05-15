# Imagem oficial Node (inclui npm). Não usar oven/bun — Baileys roda em Node.
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./

ENV NODE_ENV=production

EXPOSE 3847

CMD ["node", "server.js"]
