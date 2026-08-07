# =============================================================================
# AI Resume Optimizer — Backend Dockerfile
# =============================================================================
# Uses LibreOffice headless for DOCX → PDF conversion.
# Optimized for Render free tier (512MB RAM).
# =============================================================================

FROM node:20-slim

# Install LibreOffice Writer and Microsoft Core Fonts (minimal footprint)
RUN echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      libreoffice-writer \
      libreoffice-java-common \
      fonts-dejavu \
      fonts-liberation \
      ttf-mscorefonts-installer && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy shared package first (it's a local dependency)
COPY shared/ ./shared/

# Copy backend package files
COPY backend/package.json backend/package-lock.json* ./backend/

# Install dependencies
WORKDIR /app/backend
RUN npm install --omit=dev && npm cache clean --force

# Copy backend source
COPY backend/ ./

# Build TypeScript
RUN npm run build

# Create required directories
RUN mkdir -p uploads generated

# Expose the port
EXPOSE 8000

# Start the server
CMD ["node", "dist/index.js"]
