import type { ChatInputCommandInteraction } from 'discord.js';
import type { Db } from '../db/client.js';

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  db: Db;
}
