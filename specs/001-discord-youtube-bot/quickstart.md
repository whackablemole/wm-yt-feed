# Quickstart: Discord YouTube Channel Monitor Bot

Validates the feature end-to-end per the acceptance scenarios in
[spec.md](./spec.md). Assumes the bot has already been implemented per this
plan's [data-model.md](./data-model.md) and [contracts/](./contracts/).

## Prerequisites

- Docker and Docker Compose installed.
- A Discord application + bot token with the `applications.commands` and
  `bot` scopes, invited to a test server with the `Manage Server` permission
  granted to your own test account.
- No YouTube/Google Cloud credentials required (see research.md §2–3 — feed
  polling and page-based channel resolution need no API key).

## Setup

1. Copy `.env.example` to `.env` and set `DISCORD_TOKEN` and
   `DISCORD_CLIENT_ID` from your test bot application.
2. Start the bot:
   ```bash
   docker compose up --build
   ```
   This builds the image, creates the named SQLite volume, and starts the
   bot process, which registers its slash commands and connects to Discord.

## Validate Story 1 — configure the watch list (spec.md User Story 1)

1. In your test server, run `/youtube add channel:<a real YouTube channel URL or @handle>`.
   **Expected**: ephemeral confirmation naming the resolved channel.
2. Run `/youtube add` again with the same channel (try a different input
   format, e.g. the raw channel ID this time).
   **Expected**: "already monitored" response; `/youtube list` still shows
   only one entry for it.
3. Run `/youtube list`.
   **Expected**: the channel appears with its display name.
4. Run `/youtube remove channel:<same channel>`.
   **Expected**: confirmation; `/youtube list` no longer shows it.
5. Run `/youtube add channel:not-a-real-channel-xyz`.
   **Expected**: rejected with a clear error; nothing added.

## Validate Story 2 — configure the announcement channel (spec.md User Story 2)

1. Run `/youtube set-channel target:#announcements` (a channel the bot can
   post in).
   **Expected**: confirmation the destination is set.
2. Run `/youtube set-channel target:#general` (a second channel).
   **Expected**: confirmation the destination was replaced (not added).
3. Run `/youtube set-channel target:<a channel the bot has no Send Messages
   permission in>`.
   **Expected**: rejected with a clear permission error; prior setting
   (`#general`) remains unchanged.

## Validate Story 3 — automatic announcements

1. Re-add a YouTube channel with `/youtube add` and confirm
   `/youtube set-channel` points at a channel the bot can post in.
2. Wait for the poll interval (default ~5 minutes; see research.md §5), or
   trigger a manual poll cycle if the implementation exposes one for testing.
3. Publish (or pick an already-recent) video on the monitored channel.
   **Expected**: within one poll interval, exactly one message appears in the
   announcement channel with the video's title and link.
4. Wait for the next poll cycle without publishing anything new.
   **Expected**: no duplicate message for the same video.
5. Repeat steps 1–3 in a second test server monitoring the same YouTube
   channel, with a different announcement channel configured.
   **Expected**: each server receives its own independent announcement;
   neither server's configuration or history affects the other (SC-005).

## Validate Story 4 — restart resilience

1. With a configured watch list and announcement channel from the steps
   above, restart the container:
   ```bash
   docker compose restart
   ```
2. Run `/youtube list` and check the announcement channel behavior.
   **Expected**: watch list and announcement channel configuration are
   unchanged.
3. Confirm no previously-announced video is re-posted after restart
   (SC-003/SC-004).

## Notes

- All commands respond ephemerally (visible only to the invoking admin) so
  repeated testing doesn't clutter the test server's channels.
- Steps requiring "a real YouTube channel" can use any public channel that
  currently has an old, unlikely-to-change-soon video as its most recent
  upload, to keep the announcement step (Story 3) deterministic during
  manual testing.
