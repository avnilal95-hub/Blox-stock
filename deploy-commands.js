const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('set-stock')
    .setDescription('Set the channel where live Blox Fruits stock notifications will be posted.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The text channel for stock alerts')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('remove-stock')
    .setDescription('Stop receiving stock notifications in this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('stock')
    .setDescription('View the current Blox Fruits dealer stock immediately.'),

  new SlashCommandBuilder()
    .setName('bot-info')
    .setDescription('View status and statistics for this bot.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registering global slash commands...');
    const client_id = process.env.DISCORD_CLIENT_ID;
    if (!client_id) {
      console.error('❌ DISCORD_CLIENT_ID missing from environment variables!');
      return;
    }
    await rest.put(
      Routes.applicationCommands(client_id),
      { body: commands }
    );
    console.log('✅ Slash commands successfully registered!');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();

