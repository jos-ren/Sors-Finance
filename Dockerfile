# Stage 1: Install dependencies
FROM node:20-alpine AS deps
# Add build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
# Need build tools for native modules
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Drizzle migrations if needed
RUN npm run db:generate || true

RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Drizzle migrations
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Volume for persistent SQLite data
VOLUME ["/app/data"]

CMD ["node", "server.js"]
