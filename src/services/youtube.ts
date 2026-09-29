import Parser from 'rss-parser';

// Tried in order. The RSS autodiscovery link is the most reliable source as of
// 2026-09 — YouTube's channel pages no longer reliably embed a `"channelId":"UC..."`
// JSON literal, but they do embed a standard RSS <link> tag with the feed URL.
const CHANNEL_ID_PATTERNS = [
  /feeds\/videos\.xml\?channel_id=(UC[0-9A-Za-z_-]{22})/,
  /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[0-9A-Za-z_-]{22})"/,
  /"channelId":"(UC[0-9A-Za-z_-]{22})"/,
];
const TITLE_REGEX = /<title>(.*?)<\/title>/;

function extractChannelId(html: string): string | undefined {
  for (const pattern of CHANNEL_ID_PATTERNS) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export class ChannelResolutionError extends Error {}

export interface ResolvedChannel {
  channelId: string;
  displayName: string;
}

export interface FeedVideo {
  videoId: string;
  title: string;
  publishedAt: Date;
  url: string;
}

interface YoutubeFeedItem {
  videoId?: string;
  title?: string;
  link?: string;
  isoDate?: string;
}

// rss-parser's default User-Agent ('rss-parser') gets intermittently blocked by
// YouTube under routine polling, surfacing as spurious 404s — send the same UA
// resolveChannelReference already uses successfully.
const feedParser: Parser<Record<string, unknown>, YoutubeFeedItem> = new Parser({
  customFields: { item: [['yt:videoId', 'videoId']] },
  headers: { 'User-Agent': 'wm-yt-feed-bot' },
});

function toChannelPageUrl(reference: string): string {
  const trimmed = reference.trim();
  if (/^UC[0-9A-Za-z_-]{22}$/.test(trimmed)) {
    return `https://www.youtube.com/channel/${trimmed}`;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('@')) {
    return `https://www.youtube.com/${trimmed}`;
  }
  return `https://www.youtube.com/@${trimmed}`;
}

/** Resolves a URL/@handle/channel-ID to a canonical channel ID — see research.md §3. */
export async function resolveChannelReference(reference: string): Promise<ResolvedChannel> {
  const url = toChannelPageUrl(reference);
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': 'wm-yt-feed-bot' } });
  } catch {
    throw new ChannelResolutionError(`Could not resolve YouTube channel from "${reference}"`);
  }
  if (!response.ok) {
    throw new ChannelResolutionError(`Could not resolve YouTube channel from "${reference}"`);
  }

  const html = await response.text();
  const channelId = extractChannelId(html);
  if (!channelId) {
    throw new ChannelResolutionError(`Could not resolve YouTube channel from "${reference}"`);
  }

  const titleMatch = TITLE_REGEX.exec(html);
  const displayName = titleMatch?.[1] ? titleMatch[1].replace(/ - YouTube$/, '') : channelId;

  return { channelId, displayName };
}

function extractVideoIdFromLink(link?: string): string | undefined {
  if (!link) return undefined;
  return /[?&]v=([^&]+)/.exec(link)?.[1];
}

/** Fetches the latest videos from a channel's public Atom feed, oldest-first — see research.md §2, §7. */
export async function fetchLatestVideos(channelId: string): Promise<FeedVideo[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const feed = await feedParser.parseURL(feedUrl);

  const videos: FeedVideo[] = [];
  for (const item of feed.items ?? []) {
    const videoId = item.videoId ?? extractVideoIdFromLink(item.link);
    if (!videoId) continue;
    videos.push({
      videoId,
      title: item.title ?? 'Untitled video',
      publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
      url: item.link ?? `https://www.youtube.com/watch?v=${videoId}`,
    });
  }

  return videos.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
}
