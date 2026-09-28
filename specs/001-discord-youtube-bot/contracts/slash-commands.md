# Contract: Discord Slash Commands

This bot's only external interface is a set of Discord slash commands
(registered per-guild or globally via the Discord API) plus the messages it
posts. Each command below maps to functional requirements in
[spec.md](../spec.md).

All configuration commands (`/youtube add`, `/youtube remove`,
`/youtube list`, `/youtube set-channel`) require the invoking member to have
the `Manage Server` (administrator-equivalent) permission on the guild
(FR-013). Discord's built-in per-command `default_member_permissions` is used
to enforce this at the platform level, in addition to a server-side check.

## `/youtube add channel:<string>`

- **Maps to**: FR-001, FR-004, FR-005
- **Input**: `channel` — a YouTube channel URL, `@handle`, or raw channel ID (required, string)
- **Success response**: Ephemeral confirmation naming the resolved channel
  (display name) as now monitored for this server.
- **Error responses**:
  - Input cannot be resolved to a real YouTube channel → ephemeral error,
    no state change (FR-005).
  - Channel already monitored for this server (same canonical ID, any input
    format) → ephemeral "already monitored" message, no duplicate row
    (FR-004).
  - Invoking member lacks `Manage Server` → ephemeral permission-denied
    message (FR-013).

## `/youtube remove channel:<string>`

- **Maps to**: FR-002
- **Input**: `channel` — a YouTube channel URL, `@handle`, raw channel ID, or
  the channel's display name as shown in `/youtube list` (required, string)
- **Success response**: Ephemeral confirmation the channel was removed from
  this server's watch list.
- **Error responses**:
  - Channel is not currently on this server's watch list → ephemeral error,
    no state change.
  - Invoking member lacks `Manage Server` → ephemeral permission-denied
    message.

## `/youtube list`

- **Maps to**: FR-003
- **Input**: none
- **Success response**: Ephemeral list of all YouTube channels currently
  monitored for this server (display name + when added); explicit "no
  channels monitored yet" message when the list is empty.
- **Error responses**: none beyond the shared permission check (this command
  does not mutate state, so it is intentionally viewable by admins only for
  consistency with the other config commands — see FR-013).

## `/youtube set-channel target:<channel>`

- **Maps to**: FR-006, FR-007, FR-008
- **Input**: `target` — a Discord text channel in this server (required,
  Discord channel-type option)
- **Success response**: Ephemeral confirmation that new-video announcements
  will now post to the selected channel; if one was already configured, the
  response notes it has been replaced (FR-007).
- **Error responses**:
  - Bot lacks permission to send messages in `target` → ephemeral error
    explaining the missing permission; configuration is not saved (FR-008).
  - Invoking member lacks `Manage Server` → ephemeral permission-denied
    message.

## Outbound contract: new-video announcement message

- **Maps to**: FR-010, FR-016
- **Trigger**: The polling service (see [research.md](../research.md) §2, §5)
  detects one or more videos on a monitored channel not present in
  `AnnouncedVideo` for that server.
- **Behavior**: One message per new video is posted, in publish order, to the
  server's configured `announcement_channel_id`. Each message contains at
  minimum the video title and a direct watch link (FR-010). If no
  `announcement_channel_id` is configured for the server, no message is sent
  for that server (videos are still recorded in a way that avoids a backlog
  flood once a channel is eventually configured — see Edge Cases in
  spec.md).
- **Failure handling**: If posting fails (e.g., the configured channel was
  deleted, or the bot's permission was revoked after configuration), the
  failure is logged/surfaced rather than silently dropped, per the Edge Cases
  section of spec.md; the video is not marked as announced so a future retry
  can succeed once the problem is fixed. (An operator-facing surfacing
  mechanism, e.g. logs vs. a DM to the last admin who configured it, is an
  implementation choice left to the tasks/implementation phase — no behavior
  here is user-facing beyond "it doesn't fail silently.")
