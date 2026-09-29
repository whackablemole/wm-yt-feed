# Implementation Plan: Live Stream Notifications

**Branch**: `002-live-stream-notifications` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-live-stream-notifications/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Extend the existing polling loop so that, for each monitored channel, the bot
also checks whether it is currently live (via the same no-API-key,
page-scrape technique already used for channel resolution) and posts a
visually distinct "live now" message the moment a new broadcast is detected.
Duplicate notifications for the same ongoing broadcast are prevented by a
new nullable `activeLiveVideoId` column on `monitored_channels`, and the
later VOD upload of an already-notified broadcast is prevented from also
triggering a regular new-video announcement by writing the live video's ID
into the existing `announced_videos` dedup table at notification time — no
new dependency, API key, service, or table beyond that one column.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS *(unchanged from feature 001)*

**Primary Dependencies**: No new dependency. Reuses discord.js v14 (posting
messages), better-sqlite3 + Drizzle ORM (the new column + existing dedup
table), and the built-in `fetch` already used by `resolveChannelReference`
for the live-status check itself (research.md §1).

**Storage**: SQLite (embedded, unchanged), extended with one additive
nullable column (`monitored_channels.active_live_video_id`) via a Drizzle
migration (data-model.md).

**Testing**: Vitest, extending the existing mocked-`fetch` / mocked-`discord.js`-client
patterns already used in `tests/integration/poll-and-announce.test.ts` and
`tests/unit/services/youtube.test.ts`.

**Target Platform**: Linux container, multi-arch image (linux/amd64 +
linux/arm64) *(unchanged)*.

**Project Type**: Single long-running background service *(unchanged)*.

**Performance Goals**: Live notification appears within one poll cycle
(~5 minutes, reusing the existing cadence per the resolved FR-009
clarification) of a broadcast starting (SC-001).

**Constraints**: No new external dependency or API key (Constitution
IV/V); adds exactly one HTTP request per distinct monitored YouTube channel
per poll cycle (not per server-channel pair — grouped the same way the
existing feed fetch already is), keeping added load within the existing
Raspberry-Pi resource budget.

**Scale/Scope**: Unchanged from feature 001 (tens of Discord servers, up to
dozens of monitored channels each).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution v1.0.0 (ratified 2026-09-28):

| Principle | Status | Evidence |
|---|---|---|
| I. Discord-Native, Single-Purpose Bot | ✅ Pass | Still exactly "watch YouTube channels, post to Discord" — live notification is a new *kind* of post about the same monitored channels, not a new surface or integration. |
| II. Containerized, Portable Deployment | ✅ Pass | No change to the container/deployment model; Target Platform unchanged. |
| III. Strict Static Typing (NON-NEGOTIABLE) | ✅ Pass | New code (live-status check, schema column, repository method) is added TypeScript in the existing strict-mode project; no new untyped surface. |
| IV. Raspberry-Pi-Class Resource Discipline | ✅ Pass | Zero new dependencies (research.md §1); added load is one HTTP request per distinct channel per existing 5-minute cycle, reusing the existing scheduler and stagger delay rather than adding a second one (research.md §6). |
| V. Operational Simplicity | ✅ Pass | No new table, service, or config surface — one nullable column on an existing table (research.md §5), and the existing `announced_videos` table is reused rather than duplicated (research.md §4). |

No violations; Complexity Tracking remains empty.

**Post-Phase-1 re-check**: No change — data-model.md adds only one nullable
column to an existing table, contracts/ documents one new outbound message
type and one modified condition on an existing one, and quickstart.md
introduces no new infrastructure. Gate remains passed against v1.0.0.

## Project Structure

### Documentation (this feature)

```text
specs/002-live-stream-notifications/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── commands/          # (unchanged — no new slash commands, per spec.md Assumptions)
├── services/
│   ├── youtube.ts      # + checkLiveStatus(channelId): fetches the /live shortcut,
│   │                      # follows redirects, extracts video ID + live-marker via
│   │                      # ordered regex fallbacks (research.md §1–2)
│   ├── announcer.ts     # + postLiveNotification(...): distinct "live now" message
│   │                      # (contracts/live-notification.md)
│   └── poller.ts        # extended: per distinct channel, also run the live check
│                          # (skipped during an entry's first seed cycle — research.md §3),
│                          # update activeLiveVideoId, record into announced_videos on
│                          # notify (research.md §4)
├── db/
│   ├── schema.ts         # + monitored_channels.active_live_video_id (nullable)
│   ├── migrations/        # + generated migration adding the column
│   └── repositories/
│       └── monitored-channel.ts  # + method to read/update activeLiveVideoId
├── discord/              # (unchanged)
└── index.ts               # (unchanged)

tests/
├── unit/
│   └── services/
│       └── youtube.test.ts    # + checkLiveStatus cases: live / not live / upcoming
│                                 # premiere (false-positive guard) / fetch failure
└── integration/
    └── poll-and-announce.test.ts  # + live-notification + dedup + restart-resilience
                                      # + VOD-suppression cases, mocked /live responses

Dockerfile               # (unchanged)
docker-compose.yml        # (unchanged)
```

**Structure Decision**: No structural change from feature 001 — this
feature extends existing modules (`youtube.ts`, `announcer.ts`, `poller.ts`,
`schema.ts`, the monitored-channel repository) rather than adding new
top-level directories, services, or containers, consistent with Operational
Simplicity.

## Complexity Tracking

*No constitution violations to justify — the Constitution Check above shows
all five principles of v1.0.0 passing, and this design adds no new
dependency, service, table, or scheduling mechanism beyond one nullable
column and one new outbound message type on the existing single-service,
single-datastore architecture.*
