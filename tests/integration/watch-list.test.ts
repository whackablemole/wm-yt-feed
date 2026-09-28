import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { createTestDb } from '../helpers/db.js';
import { handleAddChannel } from '../../src/commands/add-channel.js';
import { handleRemoveChannel } from '../../src/commands/remove-channel.js';
import { handleListChannels } from '../../src/commands/list-channels.js';

const VALID_CHANNEL_HTML =
  '<html><head><title>Example - YouTube</title></head>' +
  '<body>"channelId":"UCabcdefghijklmnopqrstuv"</body></html>';

function fakeInteraction(options: { channel?: string; isAdmin?: boolean } = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  return {
    inGuild: () => true,
    guildId: 'guild-1',
    user: { id: 'admin-1' },
    memberPermissions: new PermissionsBitField(
      options.isAdmin === false ? [] : [PermissionFlagsBits.ManageGuild],
    ),
    options: { getString: () => options.channel ?? '@example' },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply,
    reply,
    deferred: false,
    replied: false,
    // Only the subset of ChatInputCommandInteraction used by the command handlers is faked here.
  } as unknown as ChatInputCommandInteraction;
}

describe('watch-list integration (US1)', () => {
  beforeEach(() => {
    // A fresh Response per call: Response bodies can only be consumed once, and both
    // add and remove may resolve the same reference via the network within one test.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response(VALID_CHANNEL_HTML, { status: 200 }))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds, lists, and removes a channel end to end', async () => {
    const db = createTestDb();

    const addInteraction = fakeInteraction();
    await handleAddChannel({ interaction: addInteraction, db });
    expect(addInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining('Now monitoring'));

    const listInteraction = fakeInteraction();
    await handleListChannels({ interaction: listInteraction, db });
    expect(listInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Example') }),
    );

    const removeInteraction = fakeInteraction();
    await handleRemoveChannel({ interaction: removeInteraction, db });
    expect(removeInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining('Stopped monitoring'));

    const listAfterRemove = fakeInteraction();
    await handleListChannels({ interaction: listAfterRemove, db });
    expect(listAfterRemove.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No YouTube channels') }),
    );
  });

  it('rejects a duplicate add without creating a second entry', async () => {
    const db = createTestDb();
    await handleAddChannel({ interaction: fakeInteraction(), db });

    const dup = fakeInteraction();
    await handleAddChannel({ interaction: dup, db });
    expect(dup.editReply).toHaveBeenCalledWith(expect.stringContaining('already being monitored'));

    const list = fakeInteraction();
    await handleListChannels({ interaction: list, db });
    const content = (list.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.content as string;
    expect(content.match(/Example/g)).toHaveLength(1);
  });

  it('rejects an unresolvable channel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })));
    const db = createTestDb();
    const bad = fakeInteraction({ channel: 'not-a-channel' });
    await handleAddChannel({ interaction: bad, db });
    expect(bad.editReply).toHaveBeenCalledWith(expect.stringContaining("Couldn't find"));
  });

  it('blocks non-admin members from adding or removing channels', async () => {
    const db = createTestDb();
    const nonAdminAdd = fakeInteraction({ isAdmin: false });
    await handleAddChannel({ interaction: nonAdminAdd, db });
    expect(nonAdminAdd.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Manage Server') }),
    );

    const nonAdminRemove = fakeInteraction({ isAdmin: false });
    await handleRemoveChannel({ interaction: nonAdminRemove, db });
    expect(nonAdminRemove.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Manage Server') }),
    );
  });
});
