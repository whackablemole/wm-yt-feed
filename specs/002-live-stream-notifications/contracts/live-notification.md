# Contract: Live Notification Messages

This feature adds no new Discord slash commands (see spec.md Assumptions);
it only adds a new outbound message and modifies the conditions under which
an existing outbound message is sent. Slash-command contracts are unchanged
from `specs/001-discord-youtube-bot/contracts/slash-commands.md`.

## Outbound contract: "live now" announcement message

- **Maps to**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
- **Trigger**: The polling service's live-status check (research.md §1, §6)
  finds a monitored channel broadcasting a public live stream whose video ID
  differs from that server's monitored-channel row's stored
  `activeLiveVideoId` (data-model.md).
- **Behavior**: One message is posted to the server's configured
  `announcementChannelId`, containing at minimum the monitored channel's
  display name, an indicator that it is live now (visually distinct from a
  regular new-video announcement per FR-003), and a direct link to the
  stream. If no `announcementChannelId` is configured for the server, no
  message is sent for that server (FR-006), but `activeLiveVideoId` is still
  recorded (dedup state is per-row, independent of whether a channel is
  configured — matches existing new-video-announcement precedent where
  unconfigured servers don't miss dedup bookkeeping when they later
  configure a channel).
- **Failure handling**: If posting fails (deleted channel, revoked
  permission), the failure is logged rather than silently dropped, matching
  the existing new-video announcement's failure handling
  (`specs/001-discord-youtube-bot/contracts/slash-commands.md`). Unlike a
  failed new-video announcement, a failed live notification does not retry
  on the next poll cycle for the same broadcast, since `activeLiveVideoId`
  is still recorded to prevent duplicate attempts — an operator who fixes
  the permission mid-broadcast will not get a late notification for that
  same broadcast, only for its next one.

## Modified outbound contract: new-video announcement message

- **Maps to**: FR-008 (modifies the existing contract in
  `specs/001-discord-youtube-bot/contracts/slash-commands.md`)
- **Change**: A video is now excluded from the new-video announcement flow
  not only when it's already in `announced_videos` from a prior new-video
  announcement, but also when it was already recorded there by a "live now"
  notification for the same broadcast (data-model.md, research.md §4). No
  code-visible distinction is needed between the two cases — both are the
  same table row from the announcement flow's point of view.
- **Net effect**: Exactly one message (the live one) is ever sent for a
  broadcast that was caught live; a broadcast that was never caught live
  (e.g., the bot was down for its entire duration) still gets exactly one
  message (the regular new-video one, once it appears in the Atom feed) —
  never zero, never two.
