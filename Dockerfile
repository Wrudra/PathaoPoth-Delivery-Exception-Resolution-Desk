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

# Public Blocks identifiers are baked in at `next build`. Runtime secrets
# (GEMINI_API_KEY) stay out of the image and come from the release secret set.
ARG NEXT_PUBLIC_BLOCKS_API_URL=https://blocksapi.slsblx.com
ARG NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY=Db2c5b9f0bfc347a9b5ae933742efbbaf
ARG NEXT_PUBLIC_BLOCKS_APP_DOMAIN=https://dblyom-elffd.slsblx.com
ARG NEXT_PUBLIC_BLOCKS_OIDC_URL=https://iam.seliseblocks.com
ARG NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID=85d564d5-abed-41a8-8792-a9b3effb8817
ARG NEXT_PUBLIC_BLOCKS_OIDC_SCOPE="openid profile offline_access"
ENV NEXT_PUBLIC_BLOCKS_API_URL=$NEXT_PUBLIC_BLOCKS_API_URL
ENV NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY=$NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY
ENV NEXT_PUBLIC_BLOCKS_APP_DOMAIN=$NEXT_PUBLIC_BLOCKS_APP_DOMAIN
ENV NEXT_PUBLIC_BLOCKS_OIDC_URL=$NEXT_PUBLIC_BLOCKS_OIDC_URL
ENV NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID=$NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID
ENV NEXT_PUBLIC_BLOCKS_OIDC_SCOPE=$NEXT_PUBLIC_BLOCKS_OIDC_SCOPE
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
