# Phase 0 Research: Discord YouTube Channel Monitor Bot

All items below were open technical decisions (the feature spec is intentionally
technology-agnostic). Each is resolved here so Phase 1 design can proceed with
no outstanding `NEEDS CLARIFICATION` markers.

## 1. Bot framework / language

- **Decision**: TypeScript 5.x on Node.js 20 LTS, using discord.js v14.
- **Rationale**: discord.js is the most mature Discord API library with
  first-class support for slash commands, permission checks, and the gateway
  events needed here; TypeScript gives compile-time safety for command option
  parsing and database models, which matters most in the config commands
  (FR-001–FR-008) where malformed input must be rejected cleanly.
- **Alternatives considered**: Python + discord.py/py-cord — equally capable,
  not chosen simply to standardize on one stack; no feature requirement favors
  either language. Rust + serenity — more operational/build overhead than this
  scale of bot warrants.

## 2. Detecting new videos on a monitored channel

- **Decision**: Poll each monitored channel's public Atom feed
  (`https://www.youtube.com/feeds/videos.xml?channel_id={UC...}`) on a
  scheduled interval (~5 minutes) and diff the returned video IDs against the
  `announced_video` table.
- **Rationale**: The feed is unauthenticated, free, and requires no Google
  Cloud project or API key — appropriate for a personal-scale, self-hosted bot
  (Scale/Scope in Technical Context). It returns the most recent ~15 videos
  per channel with title, video ID, and published timestamp, which is all
  FR-010 (post title + link) requires. A 5-minute interval leaves comfortable
  margin under the 15-minute SC-002 latency target even accounting for feed
  staleness.
- **Alternatives considered**: YouTube Data API v3 `search`/`playlistItems`
  endpoints — richer/guaranteed metadata (thumbnails, exact descriptions) but
  requires an API key and a default 10,000 units/day quota that must be
  budgeted across every monitored channel on every server; rejected as
  unnecessary operational complexity for this feature's scope. Documented as
  a future enhancement path if feed-based resolution proves unreliable for
  some channels.

## 3. Resolving a user-supplied channel reference to a canonical channel ID

- **Decision**: Accept URL, `@handle`, or raw channel ID from the add-channel
  command; fetch the corresponding public YouTube channel page and extract the
  canonical `channelId` from its metadata (the same value embedded in every
  channel page for canonical-URL/RSS purposes). Cache the resolved ID on the
  `monitored_channel` row so it never needs to be re-resolved after adding.
- **Rationale**: The Atom feed endpoint requires a raw `UC...` channel ID, but
  users naturally supply handles or full URLs (FR-001). Resolving via the
  public page requires no API key, satisfying FR-005 (reject unresolvable
  input) and FR-004 (dedup by canonical ID regardless of input format) with a
  single mechanism.
- **Alternatives considered**: YouTube Data API v3 `channels.list` with
  `forHandle`/`forUsername` — more robust resolution but reintroduces the API
  key/quota dependency rejected in item 2; kept as a fallback option worth
  revisiting if page-scraping proves fragile in practice.

## 4. Persistence

- **Decision**: Embedded SQLite (via `better-sqlite3` + Drizzle ORM), with the
  database file stored on a Docker named volume mounted into the bot's
  container.
- **Rationale**: FR-014 only requires that data survive process/container
  restarts, not multi-instance concurrent access — a single embedded file
  satisfies this with zero additional infrastructure (no second container, no
  network dependency, no credentials to manage), matching the personal/home-lab
  scale in Success Criteria. A named volume alone is sufficient for
  SC-003/SC-004 (no duplicate announcements, no reconfiguration after restart).
- **Alternatives considered**: MySQL/PostgreSQL in a sibling container — more
  conventional for multi-service deployments and would allow easy external
  inspection, but adds a second container, network wiring, and credential
  management the spec's scale doesn't require; straightforward to migrate to
  later if the bot's scope grows well beyond "tens of servers."

## 5. Scheduling the polling loop

- **Decision**: `node-cron` running inside the same process as the discord.js
  client, iterating monitored channels on a rolling schedule and staggering
  requests rather than firing all checks simultaneously.
- **Rationale**: Single-process scheduling is sufficient at this scale and
  keeps the deployable unit to one container (Project Type: single service).
  Staggering avoids bursting YouTube's feed endpoint and keeps memory/CPU
  usage low and steady, consistent with the Constraints in Technical Context.
- **Alternatives considered**: External cron triggering a separate one-shot
  process — decouples scheduling from the bot process but adds deployment
  complexity (two things to run/restart) with no benefit at this scale.

## 6. Testing approach

- **Decision**: Vitest for unit tests covering command-option validation,
  channel-reference resolution, feed-diff/dedup logic, and repository
  behavior against a temporary/in-memory SQLite database; integration tests
  drive the poll-and-announce flow against a mocked feed response and a mocked
  discord.js client (no live network/Discord calls in the suite).
- **Rationale**: Matches the acceptance scenarios in the spec (duplicate
  add, invalid channel, duplicate announcement, multi-server independence)
  directly to fast, deterministic tests without requiring live external
  services in CI.
- **Alternatives considered**: Jest — functionally similar; Vitest chosen for
  faster startup and native ESM/TypeScript support with less configuration.

## 7. Multi-video announcement ordering

- **Decision**: When multiple new videos are found for a channel in one poll
  cycle, announce them in chronological (oldest-first) order.
- **Rationale**: Gives deterministic, testable behavior for FR-016 and
  resolves the "reasonable order" language in spec.md's Edge Cases with a
  concrete rule.
- **Alternatives considered**: Newest-first — rejected as more likely to
  mislead a channel that's catching up after downtime, since it would surface
  the newest video first as if it were the only new upload.

## Outstanding clarifications

None. All Technical Context fields are resolved; no `NEEDS CLARIFICATION`
markers remain.
