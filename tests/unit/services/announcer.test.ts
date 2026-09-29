import { describe, expect, it, vi } from 'vitest';
import type { TextBasedChannel } from 'discord.js';
import { postAnnouncement, postLiveNotification } from '../../../src/services/announcer.js';

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

describe('postLiveNotification', () => {
  it('sends a message containing the channel name, live indicator, and stream link', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = { isSendable: () => true, send } as unknown as TextBasedChannel;

    await postLiveNotification(channel, 'My Channel', {
      videoId: 'live1',
      title: 'Streaming now',
      url: 'https://youtube.com/watch?v=live1',
    });

    expect(send).toHaveBeenCalledWith(expect.stringContaining('My Channel'));
    expect(send).toHaveBeenCalledWith(expect.stringContaining('Streaming now'));
    expect(send).toHaveBeenCalledWith(expect.stringContaining('https://youtube.com/watch?v=live1'));
    expect(send).toHaveBeenCalledWith(expect.stringMatching(/live/i));
  });

  it('is textually distinct from a regular new-video announcement', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = { isSendable: () => true, send } as unknown as TextBasedChannel;
    const video = { videoId: 'v1', title: 'Same Title', publishedAt: new Date(), url: 'https://youtube.com/watch?v=v1' };
    const liveVideo = { videoId: 'v1', title: 'Same Title', url: 'https://youtube.com/watch?v=v1' };

    await postAnnouncement(channel, 'My Channel', video);
    const newVideoMessage = send.mock.calls[0]?.[0] as string;

    await postLiveNotification(channel, 'My Channel', liveVideo);
    const liveMessage = send.mock.calls[1]?.[0] as string;

    expect(liveMessage).not.toBe(newVideoMessage);
  });

  it('throws when the channel is not sendable', async () => {
    const channel = { isSendable: () => false } as unknown as TextBasedChannel;
    await expect(
      postLiveNotification(channel, 'My Channel', {
        videoId: 'live1',
        title: 'x',
        url: 'https://youtube.com/watch?v=live1',
      }),
    ).rejects.toThrow();
  });
});
