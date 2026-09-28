import { describe, expect, it, vi } from 'vitest';
import type { TextBasedChannel } from 'discord.js';
import { postAnnouncement } from '../../../src/services/announcer.js';

describe('postAnnouncement', () => {
  it('sends a message containing the title and link', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    // Minimal fake of the subset of TextBasedChannel that postAnnouncement uses.
    const channel = { isSendable: () => true, send } as unknown as TextBasedChannel;

    await postAnnouncement(channel, 'My Channel', {
      videoId: 'v1',
      title: 'Cool Video',
      publishedAt: new Date(),
      url: 'https://youtube.com/watch?v=v1',
    });

    expect(send).toHaveBeenCalledWith(expect.stringContaining('Cool Video'));
    expect(send).toHaveBeenCalledWith(expect.stringContaining('https://youtube.com/watch?v=v1'));
  });

  it('throws when the channel is not sendable', async () => {
    const channel = { isSendable: () => false } as unknown as TextBasedChannel;
    await expect(
      postAnnouncement(channel, 'My Channel', {
        videoId: 'v1',
        title: 'x',
        publishedAt: new Date(),
        url: 'https://youtube.com/watch?v=v1',
      }),
    ).rejects.toThrow();
  });
});
