FROM node:20-slim

RUN apt-get update && apt-get install -y \
    libvips42 \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p /app/data

EXPOSE 4009

CMD ["node", "src/server.js"]
