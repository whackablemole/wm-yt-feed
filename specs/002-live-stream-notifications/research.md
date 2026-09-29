# Phase 0 Research: Live Stream Notifications

All items below were open technical decisions (the feature spec is
intentionally technology-agnostic). Each is resolved here so Phase 1 design
can proceed with no outstanding `NEEDS CLARIFICATION` markers.

## 1. Detecting whether a monitored channel is currently live

- **Decision**: Reuse the existing no-API-key, page-scrape pattern already
  established for channel resolution (`resolveChannelReference` in
  `src/services/youtube.ts`). Request the channel's `/live` shortcut URL
  (`https://www.youtube.com/channel/{UC...}/live`, same `User-Agent` header
  already used to avoid the intermittent blocking documented in
  `youtube.ts`) and follow redirects. YouTube resolves this URL to the
  channel's current live broadcast's watch page (`/watch?v={videoId}`) only
  while a public live stream is actually in progress; otherwise it serves
  the channel page itself with no `v=` parameter. Treat the response as
  "live" only when both (a) the final resolved URL contains a `v=` video ID
  and (b) the HTML contains a live-broadcast marker (e.g. an
  `"isLiveNow":true` style field in the embedded player-response JSON),
  mirroring the existing multi-pattern, most-reliable-first approach used by
  `CHANNEL_ID_PATTERNS`. Condition (b) exists specifically to avoid a false
  positive on an "upcoming premiere" waiting-room page, which also resolves
  to a `/watch?v=` URL but is not actually live yet.
- **Rationale**: No new dependency, no API key, no quota to manage —
  directly satisfies Constitution Principle IV/V (resource discipline,
  operational simplicity) and matches the precedent already set by decision
  §3 in `specs/001-discord-youtube-bot/research.md` for the same reasons.
  It also reuses the exact fetch/User-Agent/regex-fallback idiom already in
  the codebase rather than introducing a second, different technique.
- **Alternatives considered**: YouTube Data API v3 `search.list` with
  `eventType=live` — the only fully authoritative signal, but costs 100
  quota units per call against a default 10,000/day budget; checking even a
  handful of channels every 5 minutes would exhaust the daily quota within
  hours. Rejected for the same reason the Data API was rejected for
  new-video detection in feature 001. `videos.list` on a known video ID is
  cheap (1 unit) but still requires first discovering the candidate video ID
  and an API key — no cheaper than the scrape approach for that step, so not
  worth the added key/quota management for this feature alone.

## 2. Avoiding false "new broadcast" detections across page-markup drift

- **Decision**: Express the live-marker check as an ordered list of regex
  patterns (like `CHANNEL_ID_PATTERNS`), trying the most specific/reliable
  pattern first, so a single markup change doesn't silently disable live
  detection entirely.
- **Rationale**: `youtube.ts` already documents that YouTube's page markup
  has drifted before (see the comment above `CHANNEL_ID_PATTERNS`); the same
  risk applies here, and the same mitigation (ordered fallback patterns) is
  proven in this codebase.
- **Alternatives considered**: A single fixed pattern — simpler but exactly
  the brittleness the existing code already moved away from for channel-ID
  extraction.

## 3. Avoiding a reintroduction of the backlog-flood bug

- **Decision**: Skip the live-status check for a monitored-channel entry
  during the same poll cycle where its video history is still being seeded
  for the first time (i.e., while `AnnouncedVideoRepository.hasAnyRecorded`
  is still `false` for that entry). Live checks begin on the entry's next
  poll cycle, after seeding has completed.
- **Rationale**: Commit `4e5b350` fixed a bug where newly monitored channels
  would announce their entire back-catalog. If a live-status check were
  allowed to fire (and record an announced video) during that same seeding
  cycle, it could interact with the seeding logic in `poller.ts` in
  untested ways. Deferring live checks by one cycle for brand-new entries
  removes the interaction entirely at the cost of a one-cycle (~5 minute)
  delay in live detection for a channel that happens to already be live at
  the moment it's first monitored — an acceptable, rare edge case.
- **Alternatives considered**: Running the live check unconditionally on the
  first cycle too — rejected because it risks marking `hasAnyRecorded` true
  via the live-video's `recordAnnounced` call before the baseline seed runs,
  which would make the *next* cycle's seed check think seeding already
  happened and treat the real back-catalog as new, reintroducing the exact
  bug commit `4e5b350` fixed.

## 4. Suppressing the later VOD announcement for an already-live-notified broadcast

- **Decision**: When a live notification is sent, immediately call the
  existing `AnnouncedVideoRepository.recordAnnounced` for that broadcast's
  video ID (same table `new-video` announcements already dedup against). No
  new suppression table or flag is needed.
- **Rationale**: `pollOnce` in `poller.ts` already filters candidate videos
  through `announcedVideoRepo.isAnnounced(guildId, videoId)` before
  announcing them as new uploads. Recording the live broadcast's video ID at
  notification time means that when the same video later appears in the
  channel's normal Atom feed as a VOD, the existing filter already excludes
  it — satisfying FR-008 with zero new mechanism, and no risk of the two
  announcement paths drifting out of sync.
- **Alternatives considered**: A separate `suppressed_video_ids` table or a
  boolean flag checked by a new code path — rejected as duplicate machinery
  for something the existing dedup table already does.

## 5. Tracking "already notified for the current broadcast" (dedup + restart resilience)

- **Decision**: Add a nullable `active_live_video_id` column to
  `monitored_channels`. Set it to the current broadcast's video ID when a
  live notification is sent; clear it to `NULL` once a live check finds the
  channel no longer live. A live check only triggers a new notification
  when the currently-detected live video ID differs from the stored value
  (including when the stored value is `NULL`).
- **Rationale**: `monitored_channels` rows are already per-server
  (guild + channel), so storing the flag there gives per-server dedup
  (FR-004, FR-005) for free, and because it's a column on the existing
  SQLite-backed table it survives restarts (FR-007) the same way the rest of
  the bot's state already does — no new persistence mechanism.
- **Alternatives considered**: A separate `live_broadcast_state` table
  keyed by `monitored_channel_id` — functionally equivalent but adds a
  table/migration/repository for a single nullable value that fits
  naturally as a column on the row it describes; rejected per Constitution
  Principle V (prefer the simpler option absent a concrete need for more).

## 6. Polling cadence and request grouping

- **Decision**: Perform the live-status check on the same 5-minute
  `node-cron` cycle already used for new-video polling (per the resolved
  FR-009 clarification), and group it the same way `groupByYoutubeChannel`
  already groups the video-feed fetch: one live-status HTTP request per
  distinct YouTube channel ID per cycle, its result then applied to every
  server entry monitoring that channel, immediately adjacent to that
  channel's existing feed fetch within the same staggered iteration.
- **Rationale**: Reuses the existing scheduler, existing stagger delay, and
  existing per-distinct-channel grouping, so the added load is one extra
  HTTP request per distinct monitored channel per cycle — not per
  server-channel pair — keeping it within the Raspberry-Pi resource budget
  and requiring no new scheduling infrastructure.
- **Alternatives considered**: A separate, independent cron job for live
  checks — rejected in the clarification step of `/speckit-specify`
  (Option A chosen: reuse the existing cadence rather than add a second,
  more frequent schedule).

## Outstanding clarifications

None. All Technical Context fields are resolved; no `NEEDS CLARIFICATION`
markers remain.
