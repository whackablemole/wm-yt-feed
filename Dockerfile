# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

# better-sqlite3 needs to compile its native addon for the target architecture;
# these build tools are only used in intermediate stages, never in the final image.
FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM base AS prod-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle

VOLUME ["/data"]
CMD ["node", "dist/index.js"]
