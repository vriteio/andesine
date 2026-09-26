# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.8 prune @andesine/web --docker

FROM base AS builder
WORKDIR /app
ARG PUBLIC_API_HOST
ARG PUBLIC_APP_HOST
ARG PUBLIC_COOKIE_DOMAIN
ARG PUBLIC_SECURE
ENV PUBLIC_API_HOST="$PUBLIC_API_HOST"
ENV PUBLIC_APP_HOST="$PUBLIC_APP_HOST"
ENV PUBLIC_COOKIE_DOMAIN="$PUBLIC_COOKIE_DOMAIN"
ENV PUBLIC_SECURE="$PUBLIC_SECURE"
COPY --from=pruner /app/out/json/ ./
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
RUN pnpm build --filter=@andesine/web
RUN pnpm --config.inject-workspace-packages=true --filter @andesine/web --prod deploy /app/deploy

FROM node:24-alpine AS runner
ARG PUBLIC_API_HOST
ARG PUBLIC_APP_HOST
ARG PUBLIC_COOKIE_DOMAIN
ARG PUBLIC_SECURE
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV PUBLIC_API_HOST="$PUBLIC_API_HOST"
ENV PUBLIC_APP_HOST="$PUBLIC_APP_HOST"
ENV PUBLIC_COOKIE_DOMAIN="$PUBLIC_COOKIE_DOMAIN"
ENV PUBLIC_SECURE="$PUBLIC_SECURE"
WORKDIR /app
COPY --from=builder --chown=node:node /app/deploy ./
USER node
EXPOSE 3000
CMD ["node", "./dist/server/index.js"]
