const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('set-stock')
    .setDescription('Set the channel and stock type for automatic 4-hour updates.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The text channel for stock alerts')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Select the type of stock to monitor')
        .setRequired(true)
        .addChoices(
          { name: 'Normal Dealer Stock', value: 'normal' },
          { name: 'Mirage Island Stock', value: 'mirage' },
          { name: 'Both (Normal & Mirage)', value: 'both' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('remove-stock')
    .setDescription('Stop automatic stock notifications in this server.')
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
