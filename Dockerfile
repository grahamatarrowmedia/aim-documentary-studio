FROM node:20-slim

WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source files
COPY . .

# Build frontend
RUN npm run build

# Set production mode
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Run the server
CMD ["npm", "start"]
