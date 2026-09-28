# Phase 1 Data Model: Discord YouTube Channel Monitor Bot

Derived from the Key Entities in [spec.md](./spec.md) and the functional
requirements they support. All three tables are scoped by Discord server
(`guild_id`) per FR-012 (fully independent per-server configuration).

## MonitoredChannel

Represents a YouTube channel being watched for a specific Discord server.

| Field | Type | Notes |
|---|---|---|
| `id` | integer, PK, autoincrement | Internal identifier |
| `guild_id` | string, indexed | Discord server (guild) ID this entry belongs to |
| `youtube_channel_id` | string | Canonical resolved `UC...` channel ID (see research.md §3) |
| `display_name` | string | Channel's display name, captured at add-time for `list-channels` output |
| `added_by_user_id` | string | Discord user ID of the admin who added it |
| `added_at` | timestamp | When the channel was added |

**Constraints**:
- Unique on (`guild_id`, `youtube_channel_id`) — enforces FR-004 (no duplicate
  monitoring of the same channel per server, regardless of input format, since
  all input formats resolve to this same canonical ID before insert).

**Relationships**: many `MonitoredChannel` rows per `ServerConfiguration`
(same `guild_id`); many `AnnouncedVideo` rows reference one `MonitoredChannel`.

## ServerConfiguration

Per-Discord-server settings; one row per server that has configured anything.

| Field | Type | Notes |
|---|---|---|
| `guild_id` | string, PK | Discord server (guild) ID |
| `announcement_channel_id` | string, nullable | Discord text channel ID new-video announcements are posted to; null until configured (FR-006) |
| `updated_at` | timestamp | Last time the announcement channel was changed |

**Constraints**:
- Single row per `guild_id`. Setting a new announcement channel is an
  upsert/replace of this row's `announcement_channel_id` (FR-007 — replaces,
  never adds a second target).

**Relationships**: one `ServerConfiguration` per server, referenced implicitly
by `guild_id` on `MonitoredChannel` and `AnnouncedVideo`.

## AnnouncedVideo

Dedup record: marks that a specific video has already been announced for a
specific server, so it is never posted twice (FR-011), including across
restarts (FR-014).

| Field | Type | Notes |
|---|---|---|
| `id` | integer, PK, autoincrement | Internal identifier |
| `guild_id` | string, indexed | Discord server this announcement was posted in |
| `monitored_channel_id` | integer, FK → `MonitoredChannel.id` | Which watched channel the video came from |
| `youtube_video_id` | string | YouTube's video ID |
| `announced_at` | timestamp | When the announcement was posted |

**Constraints**:
- Unique on (`guild_id`, `youtube_video_id`) — the dedup guarantee that backs
  SC-003 and acceptance scenario "given a video already announced... does not
  post a duplicate."

**Relationships**: many `AnnouncedVideo` rows per `MonitoredChannel`.

## Cascade / lifecycle notes

- Removing a `MonitoredChannel` (FR-002) does not delete its historical
  `AnnouncedVideo` rows — they are harmless dedup history and cost nothing to
  retain; if the same channel is re-added later, prior announcements are still
  correctly treated as "already announced" and won't be reposted.
- No entity is ever shared across `guild_id` values — every query is scoped by
  `guild_id`, which is what guarantees FR-012 and SC-005 (fully independent
  per-server configuration and no cross-server leakage).
