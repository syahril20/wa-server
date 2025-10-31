# Base image Node.js 18 dengan Debian Bullseye (stabil & ringan)
FROM node:18-bullseye

# Install dependensi minimal agar Chromium jalan dengan aman
RUN apt-get update && apt-get install -y \
  chromium \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Set path Chromium agar puppeteer tahu
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package files dan install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy semua file project
COPY . .

# Jalankan aplikasi
CMD ["node", "index.js"]
