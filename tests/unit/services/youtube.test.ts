import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChannelResolutionError, resolveChannelReference } from '../../../src/services/youtube.js';

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
