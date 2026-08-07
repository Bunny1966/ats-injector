# =============================================================================
# AI Resume Optimizer — Backend Dockerfile
# =============================================================================
# Uses LibreOffice headless for DOCX → PDF conversion.
# Optimized for Render free tier (512MB RAM).
# =============================================================================

FROM node:20-slim

# Enable contrib and non-free repositories for MS fonts
RUN sed -i 's/main/main contrib non-free/g' /etc/apt/sources.list 2>/dev/null || true && \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then sed -i 's/Components: main/Components: main contrib non-free/g' /etc/apt/sources.list.d/debian.sources; fi && \
    echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      libreoffice-writer \
      libreoffice-java-common \
      fonts-dejavu \
      fonts-liberation \
      cabextract \
      fontconfig \
      ttf-mscorefonts-installer && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy shared package first (it's a local dependency)
COPY shared/ ./shared/

# Copy backend package files
COPY backend/package.json backend/package-lock.json* ./backend/

# Install all dependencies (including devDependencies required for tsc build)
WORKDIR /app/backend
RUN npm install

# Copy backend source
COPY backend/ ./

# Build TypeScript
RUN npm run build

# Prune devDependencies to save space
RUN npm prune --omit=dev && npm cache clean --force

# Create required directories
RUN mkdir -p uploads generated

# Expose the port
EXPOSE 8000

# Start the server
CMD ["node", "dist/index.js"]
