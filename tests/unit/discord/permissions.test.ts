import { describe, expect, it } from 'vitest';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { hasManageServerPermission } from '../../../src/discord/permissions.js';

describe('hasManageServerPermission', () => {
  it('returns true when the member has Manage Server permission', () => {
    const permissions = new PermissionsBitField(PermissionFlagsBits.ManageGuild);
    expect(hasManageServerPermission(permissions)).toBe(true);
  });

  it('returns false when the member lacks Manage Server permission', () => {
    const permissions = new PermissionsBitField(PermissionFlagsBits.SendMessages);
    expect(hasManageServerPermission(permissions)).toBe(false);
  });

  it('returns false when permissions are null or undefined', () => {
    expect(hasManageServerPermission(null)).toBe(false);
    expect(hasManageServerPermission(undefined)).toBe(false);
  });
});
