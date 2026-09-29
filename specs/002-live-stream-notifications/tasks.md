---
description: "Task list template for feature implementation"
---

# Tasks: Live Stream Notifications

**Input**: Design documents from `/specs/002-live-stream-notifications/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/live-notification.md, quickstart.md

**Tests**: Included. plan.md's Technical Context commits to extending the existing Vitest/mocked-`fetch`/mocked-`discord.js` approach (research.md, matching feature 001's precedent), so test tasks are generated to stay consistent with that decision.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

**Setup**: No dedicated Setup phase — this feature only extends the existing, already-scaffolded project (no new dependency, tool, or config per plan.md's Technical Context and Constitution Check). Work starts at Foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (background service), unchanged from feature 001:

```text
src/{commands,services,db,discord}/
tests/{unit,integration}/
```

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Persisted state that every user story reads or writes — MUST be complete before any user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 Add the nullable `activeLiveVideoId` column to `monitoredChannels` in `src/db/schema.ts` (data-model.md)
- [X] T002 Generate the Drizzle migration for T001 (`npm run db:generate`) and verify the generated SQL under `drizzle/` matches the additive `ALTER TABLE ... ADD COLUMN` shape described in data-model.md's Migration section
- [X] T003 Implement a method on `MonitoredChannelRepository` to read and update a row's `activeLiveVideoId` in `src/db/repositories/monitored-channel.ts` (depends on T001)
- [X] T004 [P] Unit test for the `activeLiveVideoId` read/update method (set, clear to null, persists across repository instances against the same DB) in `tests/unit/db/repositories/monitored-channel.test.ts` (depends on T003)

**Checkpoint**: Schema, migration, and repository support for live-broadcast state exist and are tested — user story implementation can now begin.

---

## Phase 2: User Story 1 - Get notified the moment a followed channel goes live (Priority: P1) 🎯 MVP

**Goal**: The bot detects when a monitored channel starts a public live stream and posts a distinct "live now" message to each server's configured announcement channel.

**Independent Test**: Configure an announcement channel, monitor a channel, have it start a live broadcast, and confirm a distinct "live now" message appears referencing that channel and a working stream link (spec.md US1 Acceptance Scenarios 1–3).

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Unit test for `checkLiveStatus` in `tests/unit/services/youtube.test.ts`: currently-live (redirect to a watch URL plus a live-marker match), not-live (no watch redirect), false-positive guard for an upcoming/premiere watch page (watch URL present but no live marker), and a fetch/network failure (research.md §1–§2)
- [X] T006 [P] [US1] Unit test for the "live now" message format in `tests/unit/services/announcer.test.ts`: includes the monitored channel's display name and a direct stream link, and is textually distinct from the existing new-video announcement format (FR-003)

### Implementation for User Story 1

- [X] T007 [US1] Implement `checkLiveStatus(channelId)` in `src/services/youtube.ts`: request the channel's `/live` shortcut URL with the existing `User-Agent` header, follow the redirect, extract a video ID from the resolved URL, and apply an ordered list of live-marker regex fallbacks (mirroring `CHANNEL_ID_PATTERNS`'s pattern) to confirm the video is actually live rather than an upcoming/premiere page (research.md §1–§2)
- [X] T008 [US1] Implement `postLiveNotification(channel, channelDisplayName, liveVideo)` in `src/services/announcer.ts` (contracts/live-notification.md)
- [X] T009 [US1] Extend `pollOnce` in `src/services/poller.ts`: for each distinct monitored YouTube channel (reusing the existing `groupByYoutubeChannel` grouping), call `checkLiveStatus` once per cycle immediately alongside the existing feed fetch; for each server entry that has already completed its first back-catalog seed (`hasAnyRecorded` true — entries still on their seed cycle are skipped per research.md §3), compare the result to the entry's stored `activeLiveVideoId`: on a live video ID that differs from the stored value, call `postLiveNotification` (only if an announcement channel is configured), record the video into `announced_videos` via `AnnouncedVideoRepository.recordAnnounced` (research.md §4 / FR-008), and persist the new `activeLiveVideoId`; when the channel is confirmed not live, clear `activeLiveVideoId` to `null`; if the live check itself fails, leave state untouched and continue (spec.md Edge Cases)
- [X] T010 [P] [US1] Integration test: a monitored channel transitioning from not-live to live produces exactly one "live now" message in the configured announcement channel containing the channel name and a link, a server with no announcement channel configured receives nothing, and two servers monitoring the same channel each receive their own independent notification (spec.md US1 Acceptance Scenarios 1–3) in `tests/integration/live-notifications.test.ts`
- [X] T011 [P] [US1] Integration test: once a live-notified broadcast's video later appears in the channel's normal Atom feed as a VOD, the regular new-video announcement is suppressed for that video — exactly one message total was sent for the broadcast (FR-008) in `tests/integration/live-notifications.test.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable — live channels are detected and produce exactly one distinguishable notification, with no redundant VOD announcement.

---

## Phase 3: User Story 2 - Don't get spammed with repeat notifications for the same stream (Priority: P2)

**Goal**: A single ongoing broadcast never produces more than one notification, while a genuinely new, separate broadcast on the same channel still gets its own.

**Independent Test**: Have a monitored channel go live and remain live across multiple consecutive status checks; confirm only one "live now" notification is posted for that broadcast, and that a subsequent distinct broadcast gets a new one (spec.md US2 Acceptance Scenarios 1–2).

### Tests for User Story 2 ⚠️

- [X] T012 [P] [US2] Integration test: repeated live checks while the same broadcast continues produce no additional "live now" messages, and once that broadcast ends and a new, separate broadcast starts on the same channel, exactly one new "live now" message is sent for it (spec.md US2 Acceptance Scenarios 1–2) in `tests/integration/live-notifications.test.ts`

### Implementation for User Story 2

- [X] T013 [US2] Verify (and adjust if needed) that `pollOnce`'s live-check handling from T009 leaves `activeLiveVideoId` unchanged specifically on a failed/erroring live-status check — as opposed to a successful check that affirmatively finds the channel not live — so a transient failure mid-broadcast can't cause a false re-notification on the next successful check (spec.md Edge Cases, research.md §1) in `src/services/poller.ts`

**Checkpoint**: Repeat-check deduplication and new-broadcast re-notification are both verified; User Stories 1 and 2 work together.

---

## Phase 4: User Story 3 - Recover live status correctly after a bot restart (Priority: P3)

**Goal**: A bot restart never causes a duplicate notification for a broadcast already announced, nor a missed notification for a broadcast still ongoing at restart.

**Independent Test**: Start a live broadcast, confirm the notification is sent, restart the bot process, and confirm no duplicate notification is sent for the same still-ongoing broadcast on the next check after restart (spec.md US3 Acceptance Scenarios 1–2).

### Tests for User Story 3 ⚠️

- [X] T014 [P] [US3] Integration test: after a broadcast has already been notified, simulate a restart (close and reopen the DB connection, per the existing pattern in `tests/integration/restart-resilience.test.ts`) and confirm the next live check for the same ongoing broadcast does not duplicate the notification; separately, confirm a broadcast that fully starts and ends while the bot is down produces no notification once the bot restarts and next checks that channel (spec.md US3 Acceptance Scenarios 1–2) in `tests/integration/restart-resilience.test.ts`

### Implementation for User Story 3

- [X] T015 [US3] Confirm no in-memory cache or module-level state is introduced anywhere in T007–T013 for live-broadcast status — `activeLiveVideoId` on the SQLite-backed `monitored_channels` row (T001–T003) must be the sole source of truth, so restart resilience holds without further code changes

**Checkpoint**: All three user stories are independently functional — live detection, dedup, and restart resilience all verified.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Keep documentation and quality gates consistent with the shipped behavior

- [X] T016 [P] Update `README.md`'s feature description to mention live-stream notifications alongside new-video announcements, so it stays accurate per the constitution's Development Workflow ("stale docs... are treated as a bug")
- [ ] T017 Run `specs/002-live-stream-notifications/quickstart.md` end-to-end against a real Discord test server and a YouTube channel that streams live, confirming the notification appears within one poll cycle of going live (SC-001)
      _(blocked: requires a real Discord bot token + a YouTube channel actually going live during testing, which this environment doesn't have — everything else has been validated with mocks/unit+integration tests; this is the one remaining manual step for whoever holds the credentials, same as T046 in feature 001)_
- [X] T018 [P] Confirm `npm run typecheck`, `npm run lint`, and `npm test` all pass with zero errors after all tasks above (constitution Principle III, NON-NEGOTIABLE)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS all user stories.
- **User Story 1 (Phase 2)**: Depends only on Foundational.
- **User Story 2 (Phase 3)**: Depends on Foundational and on User Story 1's poller integration (T009) existing to layer its dedup-failure-handling refinement and tests onto — not independently buildable before US1, since it tests and refines the same code path.
- **User Story 3 (Phase 4)**: Depends on Foundational and US1's persisted-state implementation (T001–T003, T009) already existing; its own task is verification rather than new code.
- **Polish (Phase 5)**: Depends on all desired user stories being complete.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (T005/T006 before T007/T008; T012 before T013; T014 before T015)
- Repository/schema support (Foundational) before any service code that reads/writes it
- `checkLiveStatus` (T007) and `postLiveNotification` (T008) before the poller integration that calls both (T009)
- Story complete before moving to the next priority (for solo/sequential delivery)

### Parallel Opportunities

- T004 can run in parallel with nothing else in Foundational (it's the last task, depending on T003)
- T005 and T006 (US1 tests) can run in parallel with each other
- T010 and T011 (US1 integration tests) can run in parallel with each other once T009 exists
- T016 and T018 (Polish) can run in parallel with each other

---

## Parallel Example: User Story 1

```bash
# Launch both unit tests for User Story 1 together:
Task: "Unit test for checkLiveStatus in tests/unit/services/youtube.test.ts"
Task: "Unit test for live-notification message format in tests/unit/services/announcer.test.ts"

# Once T009 (poller integration) exists, launch both integration tests together:
Task: "Integration test: live detection + per-server notification in tests/integration/live-notifications.test.ts"
Task: "Integration test: VOD-announcement suppression in tests/integration/live-notifications.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational
2. Complete Phase 2: User Story 1
3. **STOP and VALIDATE**: Test User Story 1 independently per its Independent Test criteria — this alone already delivers the feature's core value (a live notification appears) and, because T009's compare-and-update logic is written correctly from the start, incidentally already prevents most duplicate notifications too
4. Deploy/demo if ready

### Incremental Delivery

1. Foundational → schema/repository ready
2. Add User Story 1 → test independently → deploy/demo (MVP: live notifications work)
3. Add User Story 2 → test independently → deploy/demo (dedup edge cases hardened and proven)
4. Add User Story 3 → test independently → deploy/demo (restart-safe, proven)
5. Polish → docs and quality gates confirmed

### Parallel Team Strategy

With multiple developers/agents:

1. Complete Foundational together (shared prerequisite)
2. Once Foundational is done, User Story 1 is the critical path (US2 and US3 both build on its T009); a single developer/agent should own T007–T009 sequentially, while another can draft T005/T006 (tests) and T010/T011 (integration tests) in parallel against the contract in contracts/live-notification.md before T007–T009 land
3. US2 and US3 come last, once US1's poller integration exists to refine and verify

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Every task touching `.ts` files must keep `tsc --noEmit` (T018) passing — constitution Principle III is NON-NEGOTIABLE
- T009 is the single most load-bearing task in this feature — it implements FR-001, FR-002, FR-004, FR-005, FR-007, and FR-008 all at once because the spec's three user stories share one underlying state machine (data-model.md's state-transition diagram); US2 and US3's tasks exist to add targeted coverage and hardening on top of it, not to duplicate it
