import { PermissionFlagsBits, type PermissionsBitField } from 'discord.js';

/** Enforces FR-013/SC-006: only members with "Manage Server" may run configuration commands. */
export function hasManageServerPermission(
  permissions: PermissionsBitField | null | undefined,
): boolean {
  return permissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}
