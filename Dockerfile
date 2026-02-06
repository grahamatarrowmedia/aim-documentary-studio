FROM node:20-slim

WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Build args for frontend env vars (baked into bundle at build time)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_ELEVENLABS_API_KEY
ARG GEMINI_API_KEY

# Expose build args as env vars so Vite can read them during build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_ELEVENLABS_API_KEY=$VITE_ELEVENLABS_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

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
