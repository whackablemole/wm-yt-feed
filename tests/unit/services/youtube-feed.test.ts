import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockParseURL = vi.fn();
vi.mock('rss-parser', () => ({
  default: vi.fn().mockImplementation(() => ({ parseURL: mockParseURL })),
}));

// vi.mock calls are hoisted above imports by vitest, so this import gets the mocked module.
const { fetchLatestVideos } = await import('../../../src/services/youtube.js');


describe('fetchLatestVideos', () => {
  beforeEach(() => {
    mockParseURL.mockReset();
  });

  it('returns videos sorted oldest-first', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        { videoId: 'v2', title: 'Second', isoDate: '2026-01-02T00:00:00Z', link: 'https://youtube.com/watch?v=v2' },
        { videoId: 'v1', title: 'First', isoDate: '2026-01-01T00:00:00Z', link: 'https://youtube.com/watch?v=v1' },
      ],
    });

    const videos = await fetchLatestVideos('UC1');
    expect(videos.map((v) => v.videoId)).toEqual(['v1', 'v2']);
  });

  it('falls back to extracting the video ID from the link when yt:videoId is missing', async () => {
    mockParseURL.mockResolvedValue({
      items: [{ title: 'No id field', isoDate: '2026-01-01T00:00:00Z', link: 'https://youtube.com/watch?v=v3' }],
    });

    const videos = await fetchLatestVideos('UC1');
    expect(videos).toEqual([expect.objectContaining({ videoId: 'v3' })]);
  });

  it('returns an empty list when the feed has no items', async () => {
    mockParseURL.mockResolvedValue({ items: [] });
    expect(await fetchLatestVideos('UC1')).toEqual([]);
  });
});
