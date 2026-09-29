import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChannelResolutionError,
  LiveStatusCheckError,
  checkLiveStatus,
  resolveChannelReference,
} from '../../../src/services/youtube.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveChannelReference', () => {
  it('resolves the channel ID from the RSS autodiscovery link (current YouTube markup)', async () => {
    const html =
      '<html><head><title>Example Channel - YouTube</title>' +
      '<link rel="alternate" type="application/rss+xml" title="RSS" ' +
      'href="https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv">' +
      '</head><body></body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html, { status: 200 })));

    const result = await resolveChannelReference('@example');
    expect(result.channelId).toBe('UCabcdefghijklmnopqrstuv');
    expect(result.displayName).toBe('Example Channel');
  });

  it('falls back to the canonical link when the RSS link is absent', async () => {
    const html =
      '<html><head><title>Example Channel - YouTube</title>' +
      '<link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv">' +
      '</head><body></body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html, { status: 200 })));

    const result = await resolveChannelReference('@example');
    expect(result.channelId).toBe('UCabcdefghijklmnopqrstuv');
  });

  it('falls back to the legacy "channelId" JSON literal if present', async () => {
    const html =
      '<html><head><title>Example Channel - YouTube</title></head>' +
      '<body>"channelId":"UCabcdefghijklmnopqrstuv"</body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html, { status: 200 })));

    const result = await resolveChannelReference('@example');
    expect(result.channelId).toBe('UCabcdefghijklmnopqrstuv');
  });

  it('throws ChannelResolutionError when the page returns a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })));
    await expect(resolveChannelReference('not-a-real-channel')).rejects.toThrow(ChannelResolutionError);
  });

  it('throws ChannelResolutionError when the page has no channel ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 })));
    await expect(resolveChannelReference('weird-input')).rejects.toThrow(ChannelResolutionError);
  });

  it('throws ChannelResolutionError when the network request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    await expect(resolveChannelReference('@example')).rejects.toThrow(ChannelResolutionError);
  });
});

describe('checkLiveStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const LIVE_WATCH_HTML =
    '<html><head><title>Live now! - YouTube</title>' +
    '<link rel="canonical" href="https://www.youtube.com/watch?v=liveVideoID">' +
    '</head><body>"isLiveNow":true</body></html>';

  it('returns the live broadcast when the channel is currently live', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(LIVE_WATCH_HTML, { status: 200 })));

    const result = await checkLiveStatus('UCabcdefghijklmnopqrstuv');
    expect(result).toEqual({
      videoId: 'liveVideoID',
      title: 'Live now!',
      url: 'https://www.youtube.com/watch?v=liveVideoID',
    });
  });

  it('returns null when the channel page has no watch-page canonical link (not live)', async () => {
    const channelHomeHtml =
      '<html><head><title>Example Channel - YouTube</title>' +
      '<link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv">' +
      '</head><body></body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(channelHomeHtml, { status: 200 })));

    await expect(checkLiveStatus('UCabcdefghijklmnopqrstuv')).resolves.toBeNull();
  });

  it('returns null for an upcoming/premiere watch page that has no live marker (false-positive guard)', async () => {
    const upcomingHtml =
      '<html><head><title>Upcoming premiere - YouTube</title>' +
      '<link rel="canonical" href="https://www.youtube.com/watch?v=upcomingVideoID">' +
      '</head><body>"isUpcoming":true</body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(upcomingHtml, { status: 200 })));

    await expect(checkLiveStatus('UCabcdefghijklmnopqrstuv')).resolves.toBeNull();
  });

  it('throws LiveStatusCheckError when the page returns a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('error', { status: 503 })));
    await expect(checkLiveStatus('UCabcdefghijklmnopqrstuv')).rejects.toThrow(LiveStatusCheckError);
  });

  it('throws LiveStatusCheckError when the network request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(checkLiveStatus('UCabcdefghijklmnopqrstuv')).rejects.toThrow(LiveStatusCheckError);
  });
});
