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

# Runtime names only -- values come from the Blocks Release secret set.
# Do not ARG GEMINI_API_KEY: that would bake the key into the image.
FROM node:20-alpine AS runner
WORKDIR /app
ARG NEXT_PUBLIC_BLOCKS_API_URL
ARG NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY
ARG NEXT_PUBLIC_BLOCKS_APP_DOMAIN
ARG NEXT_PUBLIC_BLOCKS_OIDC_URL
ARG NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID
ARG NEXT_PUBLIC_BLOCKS_OIDC_SCOPE
ARG BLOCKS_DEV_HOST
ARG BLOCKS_DEV_PORT
ARG GEMINI_MODEL
ENV GEMINI_API_KEY=
ENV NEXT_PUBLIC_BLOCKS_API_URL=$NEXT_PUBLIC_BLOCKS_API_URL
ENV NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY=$NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY
ENV NEXT_PUBLIC_BLOCKS_APP_DOMAIN=$NEXT_PUBLIC_BLOCKS_APP_DOMAIN
ENV NEXT_PUBLIC_BLOCKS_OIDC_URL=$NEXT_PUBLIC_BLOCKS_OIDC_URL
ENV NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID=$NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID
ENV NEXT_PUBLIC_BLOCKS_OIDC_SCOPE=$NEXT_PUBLIC_BLOCKS_OIDC_SCOPE
ENV BLOCKS_DEV_HOST=$BLOCKS_DEV_HOST
ENV BLOCKS_DEV_PORT=$BLOCKS_DEV_PORT
ENV GEMINI_MODEL=$GEMINI_MODEL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
