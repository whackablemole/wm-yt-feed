# Setting up a Discord bot token and test server

This bot needs two things before it can run: a **Discord application/bot
token** (so the bot process can log in) and a **Discord server** to invite it
to for testing. Both are free and take about five minutes to set up.

If you just want a quick checklist, jump to [Summary](#summary).

## 1. Create a test Discord server

If you don't already have a private server to test in:

1. Open Discord and click the **+** button in the server sidebar.
2. Choose **Create My Own** → **For me and my friends**.
3. Give it any name (e.g. "wm-yt-feed test").
4. Inside the new server, create a text channel to receive announcements
   (e.g. `#video-announcements`) — you'll point `/youtube set-channel` at
   this later.

You need to be an administrator of this server to invite and configure the
bot, which you automatically are as its creator.

## 2. Create a Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   and log in with your Discord account.
2. Click **New Application**, give it a name (e.g. "wm-yt-feed"), and accept
   the terms.
3. On the **General Information** page, note the **Application ID** — this
   is your `DISCORD_CLIENT_ID`.

## 3. Create the bot user and get its token

1. In the left sidebar, click **Bot**.
2. Click **Reset Token** (or **Add Bot** if this is the first time) to
   generate a bot token, then click **Copy**.
   - Treat this token like a password: anyone with it can control the bot.
     Never commit it to git or post it anywhere public. If you ever suspect
     it's leaked, come back to this page and click **Reset Token** again to
     invalidate the old one.
3. This copied value is your `DISCORD_TOKEN`.
4. Under **Privileged Gateway Intents**, you don't need to enable any of the
   privileged intents (Presence, Server Members, Message Content) — this bot
   only uses slash commands and doesn't read message content.

## 4. Set the bot's permissions and invite it to your test server

1. In the left sidebar, click **OAuth2** → **URL Generator**.
2. Under **Scopes**, check:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions** (this section appears once `bot` is checked),
   check at minimum:
   - `View Channels`
   - `Send Messages`
   - (Optional but recommended) `Read Message History` — not required by
     this bot, but harmless if included.
4. Copy the **Generated URL** at the bottom of the page, paste it into your
   browser, and select your test server when prompted. Discord will show you
   exactly what permissions you're granting — confirm and authorize.
5. The bot should now appear in your test server's member list (offline,
   until you actually run it).

## 5. Configure the project with your credentials

1. In the project root, copy the example environment file if you haven't
   already:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in the two values from above:
   ```
   DISCORD_TOKEN=<the token from step 3>
   DISCORD_CLIENT_ID=<the application ID from step 2>
   ```
   Leave `DATABASE_PATH` as-is.
3. Register the bot's slash command (only needed once, or after changing the
   command definition in `src/discord/register-commands.ts`):
   ```bash
   npm install
   npm run register-commands
   ```
4. Start the bot:
   ```bash
   docker compose up --build
   ```
5. Back in your test server, type `/youtube` in any channel — the `add`,
   `remove`, `list`, and `set-channel` subcommands should appear.

From here, follow `specs/001-discord-youtube-bot/quickstart.md` to walk
through the full add-channel / set-announcement-channel / restart-resilience
validation scenarios.

## Who can run the configuration commands?

Only server members with the **Manage Server** permission can run
`/youtube add`, `/youtube remove`, and `/youtube set-channel` (see
`specs/001-discord-youtube-bot/spec.md` FR-013). As the server creator you
have this by default; to test the "non-admin blocked" behavior, create a
second Discord account (or ask a friend) without that permission and confirm
the bot rejects their attempt with a clear error.

## Summary

| What | Where to get it | Goes in |
|---|---|---|
| `DISCORD_CLIENT_ID` | Developer Portal → your app → General Information → Application ID | `.env` |
| `DISCORD_TOKEN` | Developer Portal → your app → Bot → Reset Token | `.env` |
| Test server | Create your own Discord server (you'll be its admin) | Invite the bot via the OAuth2 URL Generator (scopes: `bot`, `applications.commands`) |

No YouTube API key is needed — see the main [README](../README.md) for why.
