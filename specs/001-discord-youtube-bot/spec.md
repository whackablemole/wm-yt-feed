# Feature Specification: Discord YouTube Channel Monitor Bot

**Feature Branch**: `001-discord-youtube-bot`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "I want a Discord bot that is responsible for monitoring a set of YouTube channels that can be defined via commands, and then posted into channels specified with another command. It should be containerised, and can have databases to ensure that the data is persistent across restarts."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure which YouTube channels to monitor (Priority: P1)

As a server administrator, I want to add and remove YouTube channels from my server's watch list using bot commands, so that the bot knows which channels to check for new uploads.

**Why this priority**: Without a watch list, there is nothing for the bot to monitor or post — this is the foundational capability the rest of the feature depends on.

**Independent Test**: Can be fully tested by running the "add channel" command with a valid YouTube channel, confirming it appears in the "list channels" output, then running "remove channel" and confirming it disappears — delivers a working, persisted watch list even before any posting occurs.

**Acceptance Scenarios**:

1. **Given** an administrator in a Discord server, **When** they run the add-channel command with a valid YouTube channel (URL, handle, or ID), **Then** the channel is added to that server's watch list and the bot confirms success.
2. **Given** a channel already on the watch list, **When** an administrator runs the add-channel command with the same channel again, **Then** the bot informs them it is already being monitored and does not create a duplicate entry.
3. **Given** an administrator, **When** they run the remove-channel command for a channel currently on the watch list, **Then** the channel is removed and the bot confirms success.
4. **Given** an administrator, **When** they run the list-channels command, **Then** the bot displays all YouTube channels currently monitored for that server.
5. **Given** an administrator, **When** they run the add-channel command with an input that is not a valid, resolvable YouTube channel, **Then** the bot rejects the input with a clear error and does not add anything to the watch list.
6. **Given** a server member without "Manage Server" permission, **When** they run the add-channel or remove-channel command, **Then** the bot rejects the request with a clear permission error and the watch list is unchanged.

---

### User Story 2 - Configure where new-video announcements are posted (Priority: P1)

As a server administrator, I want to designate a Discord channel where new-video announcements should be posted, so that server members automatically see updates from monitored YouTube channels without checking YouTube themselves.

**Why this priority**: Monitoring channels has no visible value until announcements can actually reach members; this is equally foundational to Story 1 and required for any end-to-end demonstration.

**Independent Test**: Can be fully tested by running the "set announcement channel" command and confirming the bot acknowledges the new target, independent of whether any YouTube channels are yet being monitored.

**Acceptance Scenarios**:

1. **Given** an administrator in a Discord server, **When** they run the set-announcement-channel command pointing at a text channel the bot can post in, **Then** that channel is saved as the server's announcement destination and the bot confirms success.
2. **Given** a server that already has an announcement channel configured, **When** an administrator runs the set-announcement-channel command with a different channel, **Then** the destination is updated to the new channel (replacing, not adding to, the previous setting).
3. **Given** an administrator, **When** they point the set-announcement-channel command at a channel the bot does not have permission to post in, **Then** the bot rejects the configuration with a clear error explaining the permission problem.
4. **Given** a server with no announcement channel configured, **When** a monitored YouTube channel publishes a new video, **Then** the bot does not post anywhere and (optionally) surfaces this unconfigured state the next time an admin runs a configuration command.
5. **Given** a server member without "Manage Server" permission, **When** they run the set-announcement-channel command, **Then** the bot rejects the request with a clear permission error and the configuration is unchanged.

---

### User Story 3 - Automatic new-video announcements (Priority: P2)

As a server member, I want the bot to automatically post a message when a monitored YouTube channel publishes a new video, so that I find out about new uploads without leaving Discord.

**Why this priority**: This is the payoff feature that depends on Stories 1 and 2 being in place; it delivers the actual ongoing value of the bot once configuration exists.

**Independent Test**: Can be fully tested by configuring a watch list and announcement channel (Stories 1 & 2), then publishing a new video on a monitored channel (or simulating one) and confirming exactly one announcement message appears in the configured channel.

**Note on independence**: Unlike Stories 1 and 2, this story's end-to-end demo is only observable once Stories 1 and 2 are configured — automatic announcements have no meaning without a watch list and a destination. The detection/posting code itself is still an independently built and unit-testable path; only the full demo has this prerequisite.

**Acceptance Scenarios**:

1. **Given** a server with at least one monitored YouTube channel and an announcement channel configured, **When** a monitored channel publishes a new video, **Then** the bot posts a message in the announcement channel containing the video title and a link to watch it.
2. **Given** a video that has already been announced, **When** the bot next checks that channel for new uploads, **Then** it does not post a duplicate announcement for the same video.
3. **Given** multiple servers monitoring the same YouTube channel, **When** that channel publishes a new video, **Then** each server's announcement channel receives its own independent announcement.
4. **Given** the bot restarts (e.g., due to a redeploy or crash), **When** it resumes checking monitored channels, **Then** it does not re-announce videos that were already announced before the restart.

---

### User Story 4 - Bot resilience across restarts and deployment (Priority: P3)

As a server administrator, I want my server's monitored-channel list and announcement-channel setting to survive bot restarts, upgrades, or host reboots, so that I don't have to reconfigure the bot after routine maintenance.

**Why this priority**: This is a non-functional/operational requirement that reinforces Stories 1–3; without it the feature would be unusable in practice, but it has no independently observable behavior beyond "state didn't disappear."

**Independent Test**: Can be fully tested by configuring a watch list and announcement channel, deliberately restarting the bot's container/process, and confirming both the watch list and announcement channel configuration are unchanged afterward.

**Acceptance Scenarios**:

1. **Given** a server with a configured watch list and announcement channel, **When** the bot process/container is stopped and started again, **Then** all previously configured data is still present and functional.
2. **Given** the bot is deployed via its container image, **When** the container is rebuilt or redeployed without explicit data-wipe actions, **Then** existing server configurations and announcement history are retained.

---

### Edge Cases

- What happens when a monitored YouTube channel is deleted or made private after being added to the watch list? The bot should stop finding new videos for it without crashing, and should surface this state to admins when relevant (e.g., listing channels or on a failed check).
- What happens when the announcement channel is deleted from Discord while still configured as the target? The bot should detect the failed post and surface an actionable error rather than silently failing.
- How does the bot handle a YouTube channel publishing multiple videos between two consecutive checks? All new videos found since the last check must be announced, oldest-first, not just the single most recent one.
- How does the system treat YouTube Shorts, live streams, and Premieres? These are treated as videos and are eligible for announcement like any standard upload (see Assumptions).
- What happens when the bot loses permission to post in the announcement channel after it was successfully configured (e.g., permissions changed later)? The bot should fail to post that announcement and surface the problem rather than losing the update silently.
- What happens if an administrator removes the bot's access to a server or the server is deleted? That server's stored configuration becomes inert; no further action is required for this feature's scope.
- What happens when the same YouTube channel is added using different input formats (custom URL vs. handle vs. channel ID) that resolve to the same channel? The bot must recognize it as already monitored rather than creating a duplicate entry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an authorized user to add a YouTube channel (by URL, handle, or channel ID) to a specific Discord server's monitored-channel watch list via a command.
- **FR-002**: System MUST allow an authorized user to remove a previously added YouTube channel from a server's watch list via a command.
- **FR-003**: System MUST allow an authorized user to list all YouTube channels currently monitored for their server via a command.
- **FR-004**: System MUST prevent the same YouTube channel from being added twice to the same server's watch list, regardless of the input format used to reference it.
- **FR-005**: System MUST reject attempts to add a YouTube channel reference that cannot be resolved to a real, accessible YouTube channel, with a clear error message.
- **FR-006**: System MUST allow an authorized user to designate a specific Discord text channel, within their server, as the destination for new-video announcements via a command.
- **FR-007**: Setting a new announcement channel for a server MUST replace any previously configured announcement channel for that server.
- **FR-008**: System MUST reject an announcement-channel configuration if the bot lacks permission to post messages in the specified channel, with a clear error message.
- **FR-009**: System MUST periodically check each monitored YouTube channel for newly published videos.
- **FR-010**: System MUST post an announcement message containing at least the video title and a link to the video, in a server's configured announcement channel, when a new video is detected on one of that server's monitored channels.
- **FR-011**: System MUST NOT post more than one announcement for the same video on the same server, including across bot restarts.
- **FR-012**: System MUST treat each Discord server's watch list and announcement-channel configuration independently, so that the same YouTube channel can be monitored differently (or not at all) across different servers.
- **FR-013**: System MUST restrict the add-channel, remove-channel, and set-announcement-channel commands to users with server administrator (or equivalent "Manage Server") permissions; unauthorized attempts MUST be rejected with a clear message.
- **FR-014**: System MUST persist all monitored-channel watch lists, announcement-channel configuration, and record of already-announced videos so that this data survives a restart of the bot process or its container.
- **FR-015**: System MUST run as a containerized service deployable via a container image/runtime.
- **FR-016**: System MUST announce all new videos found since the previous check when multiple videos were published in that interval, not only the most recent one.

### Key Entities

- **Monitored Channel**: A YouTube channel being watched for a specific Discord server. Key attributes: YouTube channel identifier, display name, the Discord server it belongs to, when it was added, who added it.
- **Server Configuration**: Per-Discord-server settings. Key attributes: Discord server (guild) identifier, configured announcement channel identifier.
- **Announced Video Record**: A record that a specific video has already been posted for a specific server, used to prevent duplicate announcements. Key attributes: YouTube video identifier, associated monitored channel, associated Discord server, timestamp announced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can go from an empty configuration to a fully working setup (one monitored channel plus one announcement channel) in under 2 minutes using only bot commands.
- **SC-002**: New videos published on a monitored channel appear as an announcement in the configured Discord channel within 15 minutes of publishing, at least 95% of the time.
- **SC-003**: No video is ever announced more than once in the same server, across normal operation and across restarts, verified over repeated restart testing.
- **SC-004**: A server's configuration (watch list and announcement channel) survives 100% of bot restarts and redeployments without requiring reconfiguration.
- **SC-005**: The system correctly maintains fully independent configurations for at least 2 concurrent Discord servers monitoring an overlapping set of YouTube channels, with no cross-server leakage of announcements or settings.
- **SC-006**: Non-administrator users attempting configuration commands are blocked 100% of the time and receive a clear explanation.

## Assumptions

- The bot supports multiple independent Discord servers simultaneously; each server has its own fully independent watch list and announcement-channel configuration (no shared/global state between servers).
- Only users with server administrator ("Manage Server") permission may run the add-channel, remove-channel, and set-announcement-channel commands.
- Each server has exactly one shared announcement channel used for all of that server's monitored YouTube channels, rather than a separate target per monitored channel.
- "New video" includes standard uploads, YouTube Shorts, and Premieres becoming publicly available; live streams are treated as videos once they conclude and appear as standard uploads (no special live-start notification is in scope).
- Announcement messages need only contain the video title and a link at minimum; richer formatting (thumbnail, channel name, publish time) is a reasonable enhancement but not a strict requirement.
- Checking frequency is an internal implementation detail; the only external contract is the 15-minute announcement latency target in SC-002.
- The bot requires standard Discord bot permissions (view channel, send messages) in the designated announcement channel; the server administrator is responsible for granting these.
- No YouTube channel discovery/search is in scope — administrators supply a specific channel reference (URL, handle, or ID) rather than searching by name.
- No web dashboard or UI outside of Discord commands is in scope for this feature; all configuration happens via bot commands.
