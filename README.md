# wm-yt-feed

A Discord bot that monitors a configurable set of YouTube channels per server
and posts an announcement into a designated channel whenever a monitored
channel publishes a new video or starts a live stream. See
`specs/001-discord-youtube-bot/` and `specs/002-live-stream-notifications/`
for the full specs, plans, and task breakdowns this was built from.

## Requirements

- A Discord application + bot token (Discord Developer Portal), with the
  `applications.commands` and `bot` scopes, invited to your server with
  `Manage Server`-restricted command access. See
  [`Docs/discord-bot-setup.md`](Docs/discord-bot-setup.md) for a full
  walkthrough, including setting up a free test server.
- Docker and Docker Compose for running the bot.

No YouTube API key is required — the bot resolves channels and checks for new
videos using YouTube's public channel pages and Atom feeds (see
`specs/001-discord-youtube-bot/research.md`).

## Setup

1. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and
   `DISCORD_CLIENT_ID` from your Discord application. Leave `DATABASE_PATH`
   as-is — it already points inside the Docker volume.
2. Register the bot's slash command:
   ```bash
   npm install
   npm run register-commands
   ```
3. Start the bot:
   ```bash
   docker compose up --build
   ```

## Commands

All commands live under `/youtube` and require the "Manage Server" Discord
permission:

- `/youtube add channel:<url|@handle|id>` — start monitoring a channel
- `/youtube remove channel:<url|@handle|id|display name>` — stop monitoring
- `/youtube list` — list channels monitored in this server
- `/youtube set-channel target:<#channel>` — set where new-video announcements post

See `specs/001-discord-youtube-bot/contracts/slash-commands.md` for the full
command contract, and `specs/001-discord-youtube-bot/quickstart.md` for an
end-to-end validation walkthrough.

## Development

```bash
npm install
npm run dev          # run the bot with live reload (tsx)
npm run typecheck    # tsc --noEmit — strict mode is non-negotiable, see constitution
npm run lint
npm test             # vitest
npm run build        # compile to dist/
```

Database schema changes go in `src/db/schema.ts`; run `npm run db:generate` to
produce a new migration under `drizzle/`. Migrations run automatically and
idempotently on every bot startup (`src/index.ts`).

## Deployment notes

- The image is built multi-arch (`linux/amd64` + `linux/arm64`) via Docker
  Buildx — `linux/arm64` is required, not optional, since this project targets
  Raspberry-Pi-class hardware (see `.specify/memory/constitution.md`).
- All configuration is via environment variables (`.env`); there are no
  host-specific setup steps beyond running the container.
- The SQLite database lives on a named Docker volume (`bot-data`), so watch
  lists, announcement-channel configuration, and announced-video history all
  survive container restarts and redeploys.

## Known follow-ups

- `npm audit` currently reports vulnerabilities in the `vitest`/`vite`/`esbuild`
  dev-tooling chain (one rated critical: a path-traversal issue in
  `@vitest/mocker`, exploitable only when a Vite/Vitest UI dev server is
  exposed to an untrusted network — this project never runs `vitest --ui` or
  `vite dev`, and none of this tooling ships in the production image). Fixing
  it fully requires a Vitest v2 → v4 major upgrade, deliberately deferred to
  avoid destabilizing the test suite during initial implementation.
