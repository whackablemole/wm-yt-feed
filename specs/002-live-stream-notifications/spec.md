# Feature Specification: Live Stream Notifications

**Feature Branch**: `002-live-stream-notifications`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Provide a notification when one of the followed channel goes live."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get notified the moment a followed channel goes live (Priority: P1)

As a member of a Discord server that follows YouTube channels, I want the bot
to post a message as soon as one of those channels starts a live stream, so
I can join while the stream is actually happening rather than finding out
after it has ended.

**Why this priority**: This is the entire point of the feature — without
timely detection and notification of the live state, there is no feature.
Everything else (avoiding duplicates, wording, edge cases) only matters once
this works.

**Independent Test**: Configure an announcement channel, monitor a YouTube
channel, have it start a live broadcast, and confirm a distinct "live now"
message appears in the announcement channel referencing that channel and
stream.

**Acceptance Scenarios**:

1. **Given** a monitored YouTube channel that is not currently live, **When**
   that channel starts a live broadcast, **Then** the bot posts a "live now"
   notification to the server's configured announcement channel, including
   the channel's name and a link to watch the stream.
2. **Given** a server with no announcement channel configured, **When** a
   monitored channel goes live, **Then** no notification is sent to that
   server (consistent with how new-video announcements already behave).
3. **Given** the same YouTube channel is monitored by two different Discord
   servers, **When** it goes live, **Then** each server with an announcement
   channel configured receives its own independent notification.

---

### User Story 2 - Don't get spammed with repeat notifications for the same stream (Priority: P2)

As a member of a Discord server, I want to be notified only once when a
followed channel goes live, so the announcement channel isn't flooded with
repeated messages about the same ongoing stream every time the bot checks
for live status.

**Why this priority**: Without this, the feature is actively annoying rather
than useful — repeated pings for a stream people already know about would
likely get the feature turned off. It's a close second to P1 because it's
what makes P1 usable in practice.

**Independent Test**: Have a monitored channel go live and remain live across
multiple consecutive status checks; confirm only one "live now" notification
is posted for that broadcast.

**Acceptance Scenarios**:

1. **Given** a "live now" notification has already been sent for a channel's
   current broadcast, **When** the bot checks that channel's status again
   while it is still the same live broadcast, **Then** no additional
   notification is sent.
2. **Given** a channel was live and the bot already notified, **When** that
   stream ends and the channel later starts a brand-new, separate live
   broadcast, **Then** the bot sends a new "live now" notification for that
   new broadcast.

---

### User Story 3 - Recover live status correctly after a bot restart (Priority: P3)

As the operator of the bot, I want live-notification state to survive a
restart of the bot, so a routine restart doesn't cause either a missed
notification or a duplicate one for a stream that was already announced.

**Why this priority**: Restarts are routine operational events (deploys,
host reboots). This protects the guarantees of P1 and P2 across those
events but doesn't add new user-facing behavior of its own.

**Independent Test**: Start a live broadcast, confirm the notification is
sent, restart the bot process, and confirm no duplicate notification is sent
for the same still-ongoing broadcast on the next status check after restart.

**Acceptance Scenarios**:

1. **Given** the bot already sent a "live now" notification for a broadcast
   and is then restarted, **When** it next checks that channel and the same
   broadcast is still live, **Then** it does not send a second notification
   for that broadcast.
2. **Given** a monitored channel went live and its broadcast ended entirely
   while the bot was not running, **When** the bot restarts and checks that
   channel, **Then** it does not send a "live now" notification for the
   already-finished broadcast.

---

### Edge Cases

- What happens when a channel goes live and ends again entirely between two
  consecutive status checks? The bot MAY miss a very short-lived broadcast;
  this is an accepted limitation of periodic checking (see Assumptions).
- What happens when a channel is live-streaming a scheduled premiere or a
  members-only/private stream? Only a publicly viewable live broadcast
  qualifies for notification.
- What happens when a monitored channel is removed from the watch list while
  its live notification state is still active? Its live state is discarded
  along with the rest of its monitoring data, consistent with existing
  channel-removal behavior.
- What happens when the bot cannot reach YouTube to check live status during
  a given cycle? The check is skipped and retried on the next cycle, the
  same way missed video-feed fetches are already handled.
- What happens when the Discord announcement channel configured for a
  server has since been deleted or the bot no longer has permission to post
  there? The notification attempt fails silently for that server without
  affecting other servers, consistent with existing announcement behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST periodically check whether each monitored YouTube
  channel is currently broadcasting a public live stream.
- **FR-002**: System MUST post a "live now" notification to a server's
  configured announcement channel when one of that server's monitored
  channels transitions from not-live to live.
- **FR-003**: The "live now" notification MUST be visually distinguishable
  from a regular new-video announcement and MUST include the monitored
  channel's display name and a direct link to the live stream.
- **FR-004**: System MUST NOT send more than one "live now" notification per
  distinct live broadcast per server.
- **FR-005**: System MUST send a separate, independent notification for a
  channel's live status to each server that monitors that channel and has an
  announcement channel configured, matching the existing per-server
  isolation of new-video announcements.
- **FR-006**: System MUST NOT send a "live now" notification for a server
  that has not configured an announcement channel.
- **FR-007**: System MUST persist live-notification state so that a bot
  restart does not cause a duplicate notification for a broadcast already
  announced, nor a missed notification for a broadcast that is still
  ongoing when the bot restarts.
- **FR-008**: When a broadcast that already triggered a "live now"
  notification later appears in the channel's normal video feed as an
  on-demand (VOD) upload, the system MUST suppress the standard "new video"
  announcement for that same video, so each broadcast results in exactly
  one notification total (the live one).
- **FR-009**: System MUST check each monitored channel's live status on the
  same cadence as the existing new-video polling cycle (every 5 minutes),
  without introducing a separate, more frequent check.

### Key Entities

- **Live Broadcast State**: Per monitored-channel, per-server record of
  whether a "live now" notification has already been sent for the channel's
  current live broadcast, used to avoid duplicate notifications and to
  survive bot restarts. Once the broadcast's video identifier is known
  (either while live or once it settles into the channel's normal video
  feed as a VOD), it is used to suppress that video's standard "new video"
  announcement per FR-008.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a monitored channel starts a public live stream, a
  notification appears in every configured announcement channel following
  it within one polling cycle of the stream starting.
- **SC-002**: No more than one "live now" notification is ever posted per
  distinct live broadcast per server, even across many consecutive status
  checks and bot restarts during that broadcast.
- **SC-003**: A member reading the announcement channel can tell, without
  opening the link, whether a message is announcing a live stream in
  progress versus a regular new video.

## Assumptions

- A "live broadcast" means a public YouTube live stream that anyone can
  currently watch; scheduled-but-not-yet-started premieres and
  members-only/private streams are out of scope for notification.
- Very short-lived broadcasts that both start and end within a single
  polling interval may be missed entirely; this is an accepted limitation
  of periodic (rather than real-time/push-based) checking.
- Live-notification state is scoped per monitored channel per server, in
  keeping with how the existing watch list and announced-video history are
  already scoped.
- No new Discord-facing configuration (commands, options) is required for
  this feature beyond the existing "monitor a channel" and "set announcement
  channel" commands — live notifications are automatic for any already
  -monitored channel.
