# Implementation Plan: Discord YouTube Channel Monitor Bot

**Branch**: `001-discord-youtube-bot` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-discord-youtube-bot/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A containerized Discord bot that lets server administrators register YouTube channels to monitor (per server) and a shared announcement channel to post into, then periodically polls each monitored channel for new uploads and posts an announcement (title + link) the first time it sees each video. All configuration and dedup state persists in an embedded SQLite database on a Docker volume, so restarts and redeploys don't lose data or cause re-announcements.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS

**Primary Dependencies**: discord.js v14 (gateway + REST + slash commands), better-sqlite3 + Drizzle ORM (embedded storage), rss-parser (YouTube channel Atom/RSS feed polling), node-cron (scheduled polling loop)

**Storage**: SQLite (embedded, file-based), persisted via a Docker named volume

**Testing**: Vitest for unit tests (command handlers, feed-diff/dedup logic, channel-reference resolution) with mocked HTTP and mocked discord.js client; no live Discord/YouTube calls in the test suite

**Target Platform**: Linux container, multi-arch image (linux/amd64 + linux/arm64) via Docker Buildx, for portability across standard servers and ARM-based home-lab hosts

**Project Type**: Single long-running background service (no web/mobile UI; Discord slash commands + posted messages are the entire interface)

**Performance Goals**: New videos detected and announced within 15 minutes of publish for ≥95% of cases (SC-002); default per-channel poll interval of ~5 minutes gives comfortable margin

**Constraints**: Poll YouTube's public per-channel Atom feed politely (stagger checks, avoid parallel bursts; no documented hard rate limit but treat as a shared resource); respect Discord API rate limits when posting; run comfortably well under modest home-lab resource limits (indicative target: well under 256MB RAM, a fraction of a single vCPU)

**Scale/Scope**: Tens of Discord servers, each monitoring up to dozens of YouTube channels; single bot process/container, no horizontal scaling required at this scale (SC-005's 2-server independence test is a floor, not a ceiling)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Re-checked against constitution v1.0.0 (ratified 2026-09-28, after this plan was first drafted):

| Principle | Status | Evidence |
|---|---|---|
| I. Discord-Native, Single-Purpose Bot | ✅ Pass | Scope is exactly "watch YouTube channels, post to Discord" (see Summary); no web UI or unrelated integration in scope. |
| II. Containerized, Portable Deployment | ✅ Pass | Target Platform declares a multi-arch image via Docker Buildx with `linux/arm64` explicitly listed, not an afterthought. |
| III. Strict Static Typing (NON-NEGOTIABLE) | ✅ Pass | Language/Version is TypeScript 5.x; strict-mode compilation to be enforced in tasks/CI (tracked as a setup task, not yet a separate artifact). |
| IV. Raspberry-Pi-Class Resource Discipline | ✅ Pass | Constraints section already states an indicative "well under 256MB RAM, a fraction of a vCPU" budget; embedded SQLite chosen specifically to avoid a second service's overhead. |
| V. Operational Simplicity | ✅ Pass | Storage and Project Type both chose the single-container, embedded-datastore option (research.md §4) ahead of a separate DB service. |

No violations; Complexity Tracking remains empty. This plan's technical choices were made independently of the constitution but happen to already satisfy it in full — no changes required as a result of ratification.

**Post-Phase-1 re-check**: No change — data-model.md, contracts/, and quickstart.md introduce no additional services, projects, or infrastructure beyond what Technical Context already declared (single service, single embedded SQLite datastore). Gate remains passed against v1.0.0.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── commands/          # Slash command handlers: add-channel, remove-channel,
│                       # list-channels, set-announcement-channel
├── services/
│   ├── youtube.ts      # Channel reference resolution (URL/handle/ID -> canonical
│   │                    # channel ID) + Atom feed fetch/parse
│   ├── announcer.ts     # Formats and posts announcement messages via discord.js
│   └── poller.ts        # Scheduled loop: check due channels, diff against
│                          # AnnouncedVideo records, enqueue announcements
├── db/
│   ├── schema.ts         # Drizzle schema: monitored_channel, server_config,
│   │                       # announced_video
│   ├── migrations/
│   └── repositories/      # Query helpers per entity
├── discord/
│   ├── client.ts          # discord.js client bootstrap, permission checks
│   └── register-commands.ts
└── index.ts                # Process entrypoint: start client + scheduler

tests/
├── unit/                    # command handlers, youtube.ts parsing/dedup,
│                              # repository logic (in-memory/temp SQLite)
└── integration/              # end-to-end poll-and-announce flow against a
                                # mocked feed + mocked discord.js client

Dockerfile
docker-compose.yml            # bot service + named volume for the SQLite file
.env.example
```

**Structure Decision**: Single project (background service), not a web/mobile split — this feature has no frontend or separate API surface, only a Discord bot process. Persistence lives in `src/db/` as an embedded SQLite database rather than a separate database service/container, keeping the deployable unit to a single container plus one named volume.

## Complexity Tracking

*No constitution violations to justify — the Constitution Check above shows all five principles of v1.0.0 passing, and this design introduces no unusual complexity (single service, single embedded datastore, no additional projects).*
