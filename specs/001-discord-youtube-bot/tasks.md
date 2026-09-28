---
description: "Task list template for feature implementation"
---

# Tasks: Discord YouTube Channel Monitor Bot

**Input**: Design documents from `/specs/001-discord-youtube-bot/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/slash-commands.md, quickstart.md

**Tests**: Included. The spec itself doesn't mandate TDD, but plan.md's Technical Context already committed to a concrete testing approach (Vitest, mocked HTTP/discord.js client — research.md §6), so test tasks are generated to keep tasks.md consistent with that decision rather than silently dropping it.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

Single project (background service), per plan.md's Project Structure:

```text
src/{commands,services,db,discord}/
tests/{unit,integration}/
Dockerfile, docker-compose.yml, .env.example
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create the project directory structure (`src/commands/`, `src/services/`, `src/db/`, `src/discord/`, `tests/unit/`, `tests/integration/`) plus placeholder `Dockerfile`, `docker-compose.yml`, and `.env.example` at repo root, per plan.md's Project Structure
- [x] T002 Initialize the Node.js/TypeScript project: `package.json`, `tsconfig.json` with `strict: true` and related strict flags (`noImplicitAny`, `strictNullChecks`, etc.) enabled per constitution Principle III
- [x] T003 [P] Configure ESLint + Prettier for linting/formatting in `.eslintrc.cjs` / `.prettierrc`
- [x] T004 [P] Configure the Vitest test runner and a `test` script in `package.json`, per research.md §6
- [x] T005 [P] Add a `typecheck` npm script (`tsc --noEmit`) to `package.json`, to be used as the CI type-check gate required by the constitution's Development Workflow

**Checkpoint**: Project scaffolding compiles/lints/tests-run with zero source files — ready for foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Define the Drizzle ORM schema for `MonitoredChannel`, `ServerConfiguration`, and `AnnouncedVideo` (including the unique constraints from data-model.md) in `src/db/schema.ts`
- [x] T007 Set up Drizzle migrations tooling and generate the initial migration for the schema from T006 in `src/db/migrations/`
- [x] T008 Implement the SQLite database client/connection, with the database file path configurable via an environment variable, in `src/db/client.ts`
- [x] T009 Implement the discord.js client bootstrap (login, required gateway intents, `ready` event handling) in `src/discord/client.ts`
- [x] T010 Implement the slash-command registration scaffold that deploys the `/youtube` command group to Discord in `src/discord/register-commands.ts`
- [x] T011 Implement a shared "Manage Server" permission-check helper used by every configuration command, per FR-013 and contracts/slash-commands.md, in `src/discord/permissions.ts`
- [x] T012 [P] Unit test for the "Manage Server" permission-check helper (allows admins, rejects non-admin members) in `tests/unit/discord/permissions.test.ts` (covers FR-013/SC-006, per spec.md US1 Acceptance Scenario 6 and US2 Acceptance Scenario 5)
- [x] T013 [P] Implement a structured logger utility (used to surface failures per spec.md Edge Cases rather than fail silently) in `src/lib/logger.ts`
- [x] T014 Wire the DB client, discord.js client bootstrap, command registration, and logger together in the process entrypoint `src/index.ts`

**Checkpoint**: Foundation ready — bot connects to Discord, has an empty command group registered, can read/write the database, and the admin-only permission check is implemented and tested. User story implementation can now begin.

---

## Phase 3: User Story 1 - Configure which YouTube channels to monitor (Priority: P1) 🎯 MVP

**Goal**: Let a server administrator add, remove, and list the YouTube channels monitored for their server via bot commands.

**Independent Test**: Run `/youtube add`, confirm the channel appears in `/youtube list`, then `/youtube remove` and confirm it's gone — fully verifiable without any announcement-channel configuration or polling in place.

### Tests for User Story 1 ⚠️

- [x] T015 [P] [US1] Unit test for channel-reference resolution (URL/handle/ID → canonical channel ID, and rejection of unresolvable input) in `tests/unit/services/youtube.test.ts`
- [x] T016 [P] [US1] Unit test for the `MonitoredChannel` repository, including the unique-constraint/duplicate-add behavior, in `tests/unit/db/repositories/monitored-channel.test.ts`

### Implementation for User Story 1

- [x] T017 [US1] Implement the `MonitoredChannel` repository (create, list, remove, find-by-canonical-id) in `src/db/repositories/monitored-channel.ts` (depends on T006)
- [x] T018 [US1] Implement channel-reference resolution (URL/handle/ID → canonical channel ID via the channel's public page, per research.md §3) in `src/services/youtube.ts`
- [x] T019 [US1] Implement the `/youtube add` command handler, using the permission helper from T011 (FR-001, FR-004, FR-005, FR-013) in `src/commands/add-channel.ts`
- [x] T020 [US1] Implement the `/youtube remove` command handler, using the permission helper from T011 (FR-002, FR-013) in `src/commands/remove-channel.ts`
- [x] T021 [US1] Implement the `/youtube list` command handler (FR-003, FR-013) in `src/commands/list-channels.ts`
- [x] T022 [US1] Register the `add`/`remove`/`list` subcommand definitions (per contracts/slash-commands.md) in `src/discord/register-commands.ts`
- [x] T023 [P] [US1] Integration test covering add → list → remove, duplicate-add, invalid-channel-input, and non-admin-permission-denied scenarios (spec.md Acceptance Scenarios 1–6) in `tests/integration/watch-list.test.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable — a working, persisted watch list exists even with no announcement channel configured yet.

---

## Phase 4: User Story 2 - Configure where new-video announcements are posted (Priority: P1)

**Goal**: Let a server administrator designate the Discord channel new-video announcements post into.

**Independent Test**: Run `/youtube set-channel`, confirm the bot acknowledges the new target — independently verifiable with no monitored channels yet configured.

### Tests for User Story 2 ⚠️

- [x] T024 [P] [US2] Unit test for the `ServerConfiguration` repository (get/upsert, replace-not-add behavior) in `tests/unit/db/repositories/server-config.test.ts`
- [x] T025 [P] [US2] Unit test for the `/youtube set-channel` command handler, including the bot-permission rejection path, in `tests/unit/commands/set-announcement-channel.test.ts`

### Implementation for User Story 2

- [x] T026 [US2] Implement the `ServerConfiguration` repository (get/upsert announcement channel per guild) in `src/db/repositories/server-config.ts` (depends on T006)
- [x] T027 [US2] Implement the `/youtube set-channel` command handler, using the permission helper from T011 and checking the bot's send-message permission in the target channel before saving (FR-006, FR-007, FR-008, FR-013) in `src/commands/set-announcement-channel.ts`
- [x] T028 [US2] Register the `set-channel` subcommand definition in `src/discord/register-commands.ts`
- [x] T029 [P] [US2] Integration test covering set → replace → bot-permission-denied → non-admin-permission-denied scenarios (spec.md Acceptance Scenarios 1–5) in `tests/integration/announcement-channel.test.ts`

**Checkpoint**: User Stories 1 AND 2 both work independently — full configuration surface is complete.

---

## Phase 5: User Story 3 - Automatic new-video announcements (Priority: P2)

**Goal**: Automatically detect new uploads on monitored channels and post announcements to each server's configured channel.

**Independent Test**: With Stories 1 & 2 configured, publish (or simulate) a new video on a monitored channel and confirm exactly one announcement appears in the configured channel.

### Tests for User Story 3 ⚠️

- [x] T030 [P] [US3] Unit test for the `AnnouncedVideo` repository (record/isAnnounced per guild+video) in `tests/unit/db/repositories/announced-video.test.ts`
- [x] T031 [P] [US3] Unit test for YouTube Atom feed fetch/parse and new-video diff logic (multiple new videos, none new) in `tests/unit/services/youtube-feed.test.ts`
- [x] T032 [P] [US3] Unit test for announcement message formatting (title + link) in `tests/unit/services/announcer.test.ts`

### Implementation for User Story 3

- [x] T033 [US3] Implement the `AnnouncedVideo` repository (record announced video, check if already announced, scoped per guild) in `src/db/repositories/announced-video.ts` (depends on T006)
- [x] T034 [US3] Implement YouTube channel Atom feed fetch/parse (latest videos per channel) in `src/services/youtube.ts`, extending T018
- [x] T035 [US3] Implement the announcer service that formats and posts a title+link message via discord.js (FR-010) in `src/services/announcer.ts`
- [x] T036 [US3] Implement the poller service: scheduled loop over all monitored channels, diffs feed results against `AnnouncedVideo`, posts all new videos per channel in chronological (oldest-first) order, and staggers outbound requests (FR-009, FR-011, FR-016; research.md §5, §7) in `src/services/poller.ts`
- [x] T037 [US3] Wire the poller's scheduled start (node-cron) into `src/index.ts`
- [x] T038 [P] [US3] Integration test: a poll cycle with multiple new videos posts each exactly once in oldest-first order, a following poll posts no duplicates, and two servers monitoring the same channel each get independent announcements (spec.md Acceptance Scenarios 1–4, SC-005) in `tests/integration/poll-and-announce.test.ts`

**Checkpoint**: All user stories should now be independently functional — the bot's core value (automatic announcements) is delivered end-to-end.

---

## Phase 6: User Story 4 - Bot resilience across restarts and deployment (Priority: P3)

**Goal**: Ensure monitored-channel lists, announcement-channel configuration, and announcement history survive restarts and redeploys.

**Independent Test**: Configure a watch list and announcement channel, restart the bot's container, and confirm both configuration and dedup history are unchanged.

### Tests for User Story 4 ⚠️

- [x] T039 [P] [US4] Integration test that simulates a restart (closes and reopens the DB connection) and confirms watch list, announcement-channel configuration, and announced-video history all persist unchanged (spec.md Acceptance Scenarios 1–2, SC-003, SC-004) in `tests/integration/restart-resilience.test.ts`

### Implementation for User Story 4

- [x] T040 [US4] Confirm/adjust the SQLite database file path (from T008) to default into a path intended for a mounted Docker volume, documented in `.env.example`, in `src/db/client.ts`
- [x] T041 [US4] Run pending migrations automatically and idempotently on bot startup (safe to run every restart) in `src/index.ts`
- [x] T042 [US4] Add the named volume for the SQLite file to `docker-compose.yml`, matching the path from T040 (FR-014)

**Checkpoint**: All user stories independently functional and durable across restarts.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and finalize deployability

- [x] T043 [P] Write `Dockerfile` as a multi-stage build producing a minimal production image, built for `linux/amd64` and `linux/arm64` via Docker Buildx (constitution Principles II & IV)
- [x] T044 [P] Add a CI workflow that runs `typecheck` (T005) and the unit/integration test suites, and validates a multi-arch Docker build including `linux/arm64`, on every change (constitution Development Workflow)
- [x] T045 [P] Write `README.md` covering setup, required environment variables, and deployment via `docker compose up`
- [ ] T046 Run the quickstart.md validation guide end-to-end against a real Discord test server and a real YouTube channel, timing the initial setup (add channel + set announcement channel) against the under-2-minute target in SC-001
      _(blocked: requires a real Discord bot token + test server, which this environment doesn't have — everything else has been validated with mocks/unit+integration tests; this is the one remaining manual step for whoever holds the credentials)_
- [ ] T047 [P] Measure and document the running container's RAM/CPU usage against the indicative "well under 256MB RAM, a fraction of a vCPU" budget from plan.md's Constraints (constitution Principle IV)
      _(blocked: a real DISCORD_TOKEN is needed to reach a genuinely "connected and idle" state to measure; a dummy token fails auth and exits before `docker stats` can sample it — image size was verified instead, see README)_

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends only on Foundational
- **User Story 2 (Phase 4)**: Depends only on Foundational — independent of US1 (different repository, different command)
- **User Story 3 (Phase 5)**: Depends on Foundational; also functionally depends on data produced by US1 (monitored channels) and US2 (announcement channel) to be observable end-to-end, but its own tasks (repository, feed parsing, announcer, poller) can be built in parallel with US1/US2 since they touch different files
- **User Story 4 (Phase 6)**: Depends on Foundational (T006–T008) and is easiest to verify meaningfully once US1–US3 exist, but its own implementation tasks (DB path, migration-on-boot, volume wiring) don't require US1–US3 code to be written first
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Repositories before services/commands that use them
- Services before the command handlers or scheduler that call them
- Command handler implementation before its registration task in that story
- Story complete before moving to the next priority (for solo/sequential delivery)

### Parallel Opportunities

- All Setup tasks marked [P] (T003–T005) can run in parallel after T001–T002
- T012 (permission-helper test) and T013 (logger) can run in parallel with each other and with T009–T011 within Foundational
- Once Foundational (Phase 2) completes, User Story 1 and User Story 2 can be implemented in parallel (different files: `monitored-channel.ts`/`add-channel.ts` etc. vs. `server-config.ts`/`set-announcement-channel.ts`)
- All test tasks marked [P] within a story can run in parallel with each other (different files)

---

## Parallel Example: User Story 1

```bash
# Launch both tests for User Story 1 together:
Task: "Unit test for channel-reference resolution in tests/unit/services/youtube.test.ts"
Task: "Unit test for MonitoredChannel repository in tests/unit/db/repositories/monitored-channel.test.ts"
```

## Parallel Example: User Stories 1 & 2 together (post-Foundational)

```bash
# Different developers/agents can work these simultaneously — no shared files:
Task: "T017-T023 (User Story 1: watch-list commands)"
Task: "T024-T029 (User Story 2: announcement-channel command)"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (watch-list commands)
4. Complete Phase 4: User Story 2 (announcement-channel command)
5. **STOP and VALIDATE**: Both P1 stories are independently testable per their Independent Test criteria above — this is the smallest useful MVP (full configuration surface, no automated posting yet)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → test independently → demo (watch-list management works)
3. Add User Story 2 → test independently → demo (destination configurable) — MVP complete
4. Add User Story 3 → test independently → demo (the bot now actually posts announcements — the feature's core payoff)
5. Add User Story 4 → test independently → demo (restart-safe)
6. Polish (Phase 7) → deployable, CI-gated, resource-validated

### Parallel Team Strategy

With multiple developers/agents:

1. Complete Setup + Foundational together (shared prerequisite)
2. Once Foundational is done:
   - Developer/Agent A: User Story 1
   - Developer/Agent B: User Story 2
   - (User Story 3 depends conceptually on both but can have its own repository/service/poller code drafted in parallel, then integrated)
3. User Story 4 and Polish come last, after US1–US3 exist to validate against

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing (if using a strict TDD flow)
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Every task touching `.ts` files must keep `tsc --noEmit` (T005) passing — constitution Principle III is NON-NEGOTIABLE
- T043/T044 must include `linux/arm64` in the build/validation matrix — constitution Principle II requires it as first-class, not optional
- T011's permission helper (FR-013/SC-006) is tested directly in T012 and exercised end-to-end in T023/T029 — previously this had zero test coverage; see the feature's /speckit.analyze report
