# Phase 1 Data Model: Live Stream Notifications

This feature extends the existing schema from feature 001
(`specs/001-discord-youtube-bot/data-model.md`) rather than introducing new
entities. One field is added to an existing table; no other tables change
shape.

## Modified Entity: Monitored Channel (`monitored_channels`)

Represents one YouTube channel monitored by one Discord server (unchanged
from feature 001, key entity spec.md §"Live Broadcast State").

| Field | Type | Notes |
|---|---|---|
| `id` | integer, PK | *(existing, unchanged)* |
| `guildId` | text | *(existing, unchanged)* |
| `youtubeChannelId` | text | *(existing, unchanged)* |
| `displayName` | text | *(existing, unchanged)* |
| `addedByUserId` | text | *(existing, unchanged)* |
| `addedAt` | timestamp | *(existing, unchanged)* |
| `activeLiveVideoId` | text, nullable | **New.** The video ID of the live broadcast this row has already sent a "live now" notification for. `NULL` when the channel is not currently known to be live, or when it has not yet been live-checked (see research.md §3 — deferred until the entry's first back-catalog seed completes). |

**Validation / invariants**:

- `activeLiveVideoId` is only ever set to a value returned by the live-status
  check (research.md §1) for this row's `youtubeChannelId`, and only after
  the row has completed its first video-history seed (research.md §3).
- `activeLiveVideoId` MUST be cleared to `NULL` as soon as a live check finds
  the channel no longer live, so a later, separate broadcast is detected as
  new (FR-002, US2 acceptance scenario 2).
- No uniqueness constraint beyond the table's existing
  `(guildId, youtubeChannelId)` unique index — `activeLiveVideoId` is a
  per-row status field, not an identity field.

**State transitions** (per row, driven by each poll cycle's live check):

```text
NULL --(live check finds broadcast X)--> "X"   [live notification sent, FR-002/FR-004]
"X"  --(live check still finds X)-----> "X"    [no-op, dedup, FR-004]
"X"  --(live check finds no broadcast)-> NULL  [ready for next broadcast, US2 scenario 2]
"X"  --(live check finds broadcast Y)--> "Y"   [new notification sent — same poll cycle
                                                 can both close out X and open Y if the
                                                 feed detects the channel already moved
                                                 on to a new broadcast between polls]
```

## Reused Entity: Announced Video (`announced_videos`)

No schema change. Reused as the single source of truth for "has this video
already been announced to this server," now written from two triggers
instead of one:

1. *(existing, unchanged)* The regular new-video poll, once a video is
   found in the channel's Atom feed and posted as a new-video announcement.
2. **(new)** The live-notification path, immediately when a "live now"
   notification is sent — recording the broadcast's video ID before it ever
   appears in the Atom feed. This is what satisfies FR-008 (suppressing the
   later VOD announcement for the same broadcast) — see research.md §4.

No new columns or indexes are needed; the existing
`(guildId, youtubeVideoId)` unique index already accepts a row written by
either trigger interchangeably.

## Migration

One additive, backward-compatible column:

```sql
ALTER TABLE monitored_channels ADD COLUMN active_live_video_id text;
```

Generated via `npm run db:generate` against the updated Drizzle schema, and
applied automatically on bot startup by the existing `runMigrations` call in
`src/db/client.ts` — no manual migration step, consistent with feature 001.
