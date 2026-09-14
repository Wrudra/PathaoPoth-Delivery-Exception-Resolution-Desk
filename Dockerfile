FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runtime names only. Values come from the Blocks Release secret set at
# container start (start.sh). Do not ARG GEMINI_API_KEY.
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache nginx \
  && mkdir -p /run/nginx /var/lib/nginx/tmp /var/log/nginx

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN mkdir -p .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 8080
CMD ["./start.sh"]
