require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  REST, 
  Routes,
  MessageFlags,
  ActivityType
} = require('discord.js');
const axios = require('axios');

// Initialize Discord Client with appropriate intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages
  ]
});

// Storage map for multi-server support: Server ID -> Channel ID
// Falls back to CHANNEL_ID env variable for single-server testing
const serverChannelMap = new Map();
let globalPreviousStock = [];
let lastCheckTimestamp = null;

// Complete Mapping of Blox Fruits to Custom Discord Emoji IDs
const FRUIT_EMOJIS = {
  "Rocket": "<:Rocket:1532341879092285581>",
  "Spin": "<:Spin:1532342070306541680>",
  "Chop": "<:Chop:1532342156541300766>",
  "Spring": "<:Spring:1532342243841802310>",
  "Bomb": "<:Bomb:1532342343829815326>",
  "Smoke": "<:Smoke:1532342431016685638>",
  "Spike": "<:Spike:1532342519130488842>",
  "Flame": "<:Flame:1532342625955217469>",
  "Ice": "<:Ice:1532342711171027085>",
  "Sand": "<:Sand:1532342791877951578>",
  "Dark": "<:Dark:1532342891580489838>",
  "Eagle": "<:Eagle:1532343000737251369>",
  "Falcon": "<:Eagle:1532343000737251369>",
  "Diamond": "<:Diamond:1532343116433195110>",
  "Light": "<:Light:1532343251632390285>",
  "Rubber": "<:Rubber:1532343340312301598>",
  "Ghost": "<:Ghost:1532343443702153389>",
  "Magma": "<:Magma:1532343545464225964>",
  "Quake": "<:Quake:1532343645359837266>",
  "Buddha": "<:Buddha:1532343740251766905>",
  "Love": "<:Love:1532343849610117181>",
  "Creation": "<:Creation:1532343933739335752>",
  "Barrier": "<:Creation:1532343933739335752>",
  "Spider": "<:Spider:1532344023623401482>",
  "Sound": "<:Sound:1532344109841387561>",
  "Phoenix": "<:Pheonix:1532344199855341772>",
  "Pheonix": "<:Pheonix:1532344199855341772>",
  "Portal": "<:Portal:1532344294965510154>",
  "Lightning": "<:Lightning:1532344389433557112>",
  "Rumble": "<:Lightning:1532344389433557112>",
  "Pain": "<:Pain:1532344553917517824>",
  "Blizzard": "<:Blizzard:1532344646636671027>",
  "Gravity": "<:Gravity:1532344776437796935>",
  "Mammoth": "<:Mammoth:1532344889260376227>",
  "Trex": "<:Trex:1532345072807313521>",
  "T-Rex": "<:Trex:1532345072807313521>",
  "Dough": "<:Dough:1532345201996071003>",
  "Shadow": "<:Shadow:1532345326013386823>",
  "Venom": "<:Venom:1532345440001982515>",
  "Gas": "<:Gas:1532345554875449415>",
  "Spirit": "<:Spirit:1532345669954830417>",
  "Tiger": "<:Tiger:1532345806512717884>",
  "Leopard": "<:Tiger:1532345806512717884>",
  "Yeti": "<:Yeti:1532345909520765018>",
  "Kitsune": "<:Kitsune:1532346015879921724>",
  "Control": "<:Control:1532346137435046019>",
  "Dragon": "<:Dragon:1532346315156095157>"
};

// ==========================================
// 1. SLASH COMMAND DEFINITIONS
// ==========================================
const commands = [
  new SlashCommandBuilder()
    .setName('set-stock')
    .setDescription('Configure the channel where Blox Fruits stock notifications will be posted.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Select the target text channel')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Manually fetch and display the current Blox Fruits stock right now.'),

  new SlashCommandBuilder()
    .setName('bot-info')
    .setDescription('Display detailed technical diagnostics, ping, and status for the stock bot.')
];

// ==========================================
// 2. GLOBAL SLASH COMMAND REGISTRATION
// ==========================================
async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    console.log('[System] Deploying global application (/) commands...');
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('✅ Successfully registered global slash commands across all joined servers!');
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error.message);
  }
}

// ==========================================
// 3. API FETCHING & DATA PARSING ENGINE
// ==========================================
async function fetchRawStockData() {
  const options = {
    method: 'GET',
    url: 'https://blox-fruit-stock-fruit.p.rapidapi.com/',
    params: { mode: 'normal' },
    headers: {
      'x-rapidapi-host': 'blox-fruit-stock-fruit.p.rapidapi.com',
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 10000 // 10 second safety timeout
  };

  try {
    const response = await axios.request(options);
    if (!response || !response.data) return null;

    const raw = response.data;
    let fruitsList = [];

    // Support multiple JSON response formats
    if (Array.isArray(raw)) {
      fruitsList = raw;
    } else if (raw.fruits && Array.isArray(raw.fruits)) {
      fruitsList = raw.fruits;
    } else if (raw.stock && Array.isArray(raw.stock)) {
      fruitsList = raw.stock;
    } else if (typeof raw === 'object') {
      fruitsList = Object.values(raw).filter(item => typeof item === 'object' || typeof item === 'string');
    }

    return fruitsList;
  } catch (error) {
    console.error('[API Gateway Error]:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Format stock items into a clean Discord embed list
function createStockEmbed(fruitsList, isManual = false) {
  const stockLines = fruitsList.map(fruit => {
    const fruitName = typeof fruit === 'string' ? fruit : (fruit.name || fruit.title || 'Unknown Fruit');
    const fruitImg = FRUIT_EMOJIS[fruitName] || '🍎'; 
    const fruitPrice = (fruit && fruit.price) ? `$${Number(fruit.price).toLocaleString()}` : 'In Stock';

    return `${fruitImg} **${fruitName}** — \`${fruitPrice}\``;
  }).join('\n');

  const titlePrefix = isManual ? '🔍 Manual Stock Query' : '🏴‍☠️ Blox Fruits Dealer Stock Update';

  return new EmbedBuilder()
    .setTitle(titlePrefix)
    .setColor('#00FF7F')
    .setTimestamp()
    .setDescription(stockLines || 'No fruit data available at this time.')
    .setFooter({ 
      text: `Blox Fruits Stock Monitor • Total Fruits: ${fruitsList.length}`, 
      iconURL: client.user.displayAvatarURL() 
    });
}

// ==========================================
// 4. PERIODIC MONITOR & BROADCAST LOGIC
// ==========================================
async function checkAndBroadcastStock(forceSend = false) {
  console.log('[Monitor] Executing stock check...');
  const currentFruits = await fetchRawStockData();

  if (!currentFruits || currentFruits.length === 0) {
    console.log('[Monitor] Stock check skipped: No data returned from RapidAPI.');
    return;
  }

  lastCheckTimestamp = new Date();
  const currentNames = currentFruits.map(item => typeof item === 'string' ? item : (item.name || item.title));
  const hasChanged = JSON.stringify(currentNames) !== JSON.stringify(globalPreviousStock);

  if (hasChanged || forceSend) {
    globalPreviousStock = currentNames;
    const stockEmbed = createStockEmbed(currentFruits, false);

    // Collect target channels (Default Env Channel + Guild Specific Configs)
    const targetChannels = new Set();
    if (process.env.CHANNEL_ID) targetChannels.add(process.env.CHANNEL_ID);
    for (const channelId of serverChannelMap.values()) {
      targetChannels.add(channelId);
    }

    if (targetChannels.size === 0) {
      console.log('⚠️ No target channels configured. Use /set-stock on a server to set alerts!');
      return;
    }

    console.log(`[Broadcast] Sending stock update to ${targetChannels.size} target channel(s)...`);

    for (const channelId of targetChannels) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [stockEmbed] });
          console.log(`✅ Broadcast successful to Channel ID: ${channelId}`);
        }
      } catch (err) {
        console.error(`❌ Failed to send to channel ${channelId}:`, err.message);
      }
    }
  } else {
    console.log('[Monitor] Stock has not changed since last check. Skipping broadcast.');
  }
}

// ==========================================
// 5. INTERACTION & COMMAND HANDLERS
// ==========================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Handler for /set-stock
  if (commandName === 'set-stock') {
    const targetChannel = interaction.options.getChannel('channel');

    if (!targetChannel.isTextBased()) {
      return interaction.reply({
        content: '❌ Please select a valid text channel!',
        flags: MessageFlags.Ephemeral
      });
    }

    serverChannelMap.set(interaction.guildId, targetChannel.id);

    await interaction.reply({
      content: `✅ Blox Fruits stock alerts for **${interaction.guild.name}** will now post to ${targetChannel}!`,
      flags: MessageFlags.Ephemeral
    });

    // Run immediate check to publish to newly set channel
    checkAndBroadcastStock(true);
  }

  // Handler for /stock (On-Demand Query)
  if (commandName === 'stock') {
    await interaction.deferReply(); // Prevents interaction timeout during API call

    const currentFruits = await fetchRawStockData();

    if (!currentFruits || currentFruits.length === 0) {
      return interaction.editReply({
        content: '⚠️ Failed to fetch live stock data from the server. Please try again in a moment.'
      });
    }

    const embed = createStockEmbed(currentFruits, true);
    await interaction.editReply({ embeds: [embed] });
  }

  // Handler for /bot-info
  if (commandName === 'bot-info') {
    const ping = client.ws.ping;
    const activeGuilds = client.guilds.cache.size;
    const configuredChannels = serverChannelMap.size;
    const lastCheckTime = lastCheckTimestamp ? `<t:${Math.floor(lastCheckTimestamp.getTime() / 1000)}:R>` : 'Never';

    const infoEmbed = new EmbedBuilder()
      .setTitle('⚙️ Bot Diagnostics & Status')
      .setColor('#0099FF')
      .addFields(
        { name: '📡 Discord Ping', value: `\`${ping}ms\``, inline: true },
        { name: '🌐 Active Guilds', value: `\`${activeGuilds} servers\``, inline: true },
        { name: '📢 Configured Alert Channels', value: `\`${configuredChannels} channels\``, inline: true },
        { name: '⏱️ Last Stock Check', value: lastCheckTime, inline: false }
      )
      .setFooter({ text: 'Blox Fruits Alert System v2.0' })
      .setTimestamp();

    await interaction.reply({ embeds: [infoEmbed], flags: MessageFlags.Ephemeral });
  }
});

// ==========================================
// 6. BOT STARTUP & ACTIVITY LIFECYCLE
// ==========================================
client.once('ready', async () => {
  console.log(`==========================================`);
  console.log(`✅ Logged in successfully as: ${client.user.tag}`);
  console.log(`🌐 Bot is active in ${client.guilds.cache.size} server(s)`);
  console.log(`==========================================`);

  // Register slash commands globally on startup
  await registerCommands();

  // Set initial status presence
  client.user.setPresence({
    activities: [{ name: 'Blox Fruits Dealer Stock | /stock', type: ActivityType.Watching }],
    status: 'online'
  });

  // Run stock check immediately on boot
  checkAndBroadcastStock();

  // Loop stock check every 15 minutes (900,000 ms)
  setInterval(() => {
    checkAndBroadcastStock();
  }, 15 * 60 * 1000);
});

// Log in bot using token
client.login(process.env.DISCORD_TOKEN);
    
