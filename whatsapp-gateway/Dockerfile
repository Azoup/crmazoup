FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./

ENV NODE_ENV=production
# Railway injeta PORT automaticamente

EXPOSE 3847

CMD ["npm", "start"]
