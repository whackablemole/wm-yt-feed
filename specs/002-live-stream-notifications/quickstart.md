# Quickstart: Live Stream Notifications

Validates the feature end-to-end per the acceptance scenarios in
[spec.md](./spec.md). Assumes the bot already has feature 001 running (watch
list + announcement channel configured) and has been extended per this
plan's [data-model.md](./data-model.md) and [contracts/](./contracts/).

## Prerequisites

- Everything from `specs/001-discord-youtube-bot/quickstart.md` Setup
  already done: bot running via `docker compose up --build`, test server
  with `/youtube set-channel` pointed at a channel the bot can post in.
- A monitored YouTube channel that streams live periodically and
  predictably enough to test against (e.g. a channel you control, or one
  with a known regular live schedule). No YouTube/Google Cloud credentials
  needed (research.md §1 — no API key).

## Validate Story 1 — notified when a channel goes live (spec.md User Story 1)

1. `/youtube add channel:<a channel that streams live>` if not already
   monitored, then wait one full poll cycle (~5 minutes) so its back-catalog
   seed completes (research.md §3 — live checks are deferred until after the
   first seed).
2. Start (or wait for) a live broadcast on that channel.
3. Wait up to one poll cycle after the stream starts.
   **Expected**: a "live now" message appears in the announcement channel,
   visually distinct from a regular new-video announcement, naming the
   channel and linking directly to the stream (SC-001, SC-003).
4. With no announcement channel configured in a second test server that
   also monitors the same channel, confirm no message is sent there
   (acceptance scenario 2) while a server that *does* have one configured
   still receives its own (acceptance scenario 3).

## Validate Story 2 — no duplicate notifications (spec.md User Story 2)

1. While the same broadcast from Story 1 is still live, wait for at least
   one more poll cycle.
   **Expected**: no second "live now" message for the same broadcast
   (SC-002).
2. Let the broadcast end. Wait for the poll cycle that first detects it has
   ended, then start a genuinely new, separate broadcast on the same
   channel.
   **Expected**: a new "live now" message is sent for the new broadcast —
   it is not treated as a duplicate of the first.
3. Once the first broadcast's recording appears in the channel's normal
   upload feed as a VOD, confirm it does **not** also trigger a regular
   new-video announcement (FR-008) — only the one live message from Story 1
   should ever appear for that video.

## Validate Story 3 — restart resilience (spec.md User Story 3)

1. While a broadcast is live and has already been notified, restart the
   container:
   ```bash
   docker compose restart
   ```
2. Wait for the next poll cycle after restart, with the same broadcast
   still live.
   **Expected**: no duplicate "live now" message is sent.
3. Separately: stop the container, let a monitored channel's live broadcast
   both start and completely end while the bot is down, then start the
   container again.
   **Expected**: no "live now" message is sent for the already-finished
   broadcast once the bot comes back up and next checks that channel.

## Notes

- Because live streams are time-sensitive and not fully controllable in a
  test environment, prefer a channel you control (or a scheduled test
  stream) over waiting on a third party's unpredictable schedule.
- If manual live testing isn't practical, the automated test suite (see
  tasks.md once generated) covers all of the above deterministically against
  a mocked `/live` response, matching the existing pattern in
  `tests/integration/poll-and-announce.test.ts`.
