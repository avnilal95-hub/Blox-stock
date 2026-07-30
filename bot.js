const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const DB_FILE = path.join(__dirname, 'guild_channels.json');
let previousStock = { normal: [], mirage: [] };

// Custom Emoji Dictionary
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

// Guild Settings Storage
function loadGuildChannels() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading DB:', err.message);
  }
  return {};
}

function saveGuildChannels(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing DB:', err.message);
  }
}

// Scrape live stock data
async function getLiveStock() {
  try {
    const { data } = await axios.get('https://bloxfruitsvalues.com/stock', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 8000
    });

    const $ = cheerio.load(data);
    const normalStock = [];
    const mirageStock = [];

    // Parse stock items
    $('.fruit-card, .stock-item').each((_, el) => {
      const name = $(el).find('.name, .fruit-name').text().trim();
      const price = $(el).find('.price').text().trim();
      const isMirage = $(el).parents('.mirage-section').length > 0;

      if (name) {
        const item = { name, price: price || 'In Stock' };
        if (isMirage) {
          mirageStock.push(item);
        } else {
          normalStock.push(item);
        }
      }
    });

    return { normal: normalStock, mirage: mirageStock };
  } catch (err) {
    console.error('[Scraper Error]:', err.message);
    return { normal: [], mirage: [] };
  }
}

// Build formatted Discord embed based on stock type
function buildStockEmbed(stockData, stockType = 'normal') {
  const embed = new EmbedBuilder()
    .setColor('#00FF7F')
    .setTimestamp()
    .setFooter({ text: 'Blox Fruits Auto-Stock • Resets every 4 hours' });

  let description = '';

  if (stockType === 'normal' || stockType === 'both') {
    embed.setTitle('🏴‍☠️ Blox Fruits — Live Dealer Stock');
    const items = stockData.normal.length > 0 ? stockData.normal : [];
    description += items.map(i => `${FRUIT_EMOJIS[i.name] || '🍎'} **${i.name}** — \`${i.price}\``).join('\n');
  }

  if (stockType === 'mirage' || stockType === 'both') {
    if (stockType === 'both') description += '\n\n**🏝️ Mirage Island Stock:**\n';
    else embed.setTitle('🏝️ Blox Fruits — Mirage Island Stock');

    const mirageItems = stockData.mirage.length > 0 ? stockData.mirage : [];
    if (mirageItems.length > 0) {
      description += mirageItems.map(i => `${FRUIT_EMOJIS[i.name] || '🍎'} **${i.name}** — \`${i.price}\``).join('\n');
    } else if (stockType === 'mirage') {
      description += '⚠️ Mirage Island Stock is currently unavailable or inactive.';
    }
  }

  embed.setDescription(description || '⚠️ No stock retrieved at this time.');
  return embed;
}

// Post automated stock alerts to a single guild or all guilds
async function sendStockUpdateToGuild(guildId, config, stockData) {
  try {
    const channel = await client.channels.fetch(config.channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const embed = buildStockEmbed(stockData, config.stockType);
      await channel.send({
        content: `🚨 **AUTOMATIC 4-HOUR STOCK UPDATE (${config.stockType.toUpperCase()})**`,
        embeds: [embed]
      });
    }
  } catch (err) {
    console.error(`Failed posting to guild ${guildId}:`, err.message);
  }
}

async function checkAndBroadcastStock(forceSend = false) {
  const currentData = await getLiveStock();
  if (currentData.normal.length === 0 && currentData.mirage.length === 0) return;

  const currentNormalNames = currentData.normal.map(f => f.name).sort().join(',');
  const prevNormalNames = previousStock.normal.map(f => f.name).sort().join(',');

  if (forceSend || currentNormalNames !== prevNormalNames) {
    previousStock = currentData;
    const db = loadGuildChannels();

    console.log(`[Notifier] Running 4-hour automatic broadcast to ${Object.keys(db).length} server(s)...`);

    for (const [guildId, config] of Object.entries(db)) {
      // Compatibility for legacy string config
      const channelConfig = typeof config === 'string' ? { channelId: config, stockType: 'normal' } : config;
      await sendStockUpdateToGuild(guildId, channelConfig, currentData);
    }
  }
}

// Bot Startup Lifecycle
client.once(Events.ClientReady, async c => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  previousStock = await getLiveStock();

  // Blox Fruits Dealer resets every 4 hours (At 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)
  // Cron schedule runs automatically every 4 hours
  cron.schedule('0 */4 * * *', () => {
    console.log('[Timer] 4-Hour restock cycle triggered!');
    checkAndBroadcastStock(true);
  });
});

// Slash Command Handler
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Command: /set-stock channel: #channel type: [normal/mirage/both]
  if (commandName === 'set-stock') {
    const channel = interaction.options.getChannel('channel');
    const type = interaction.options.getString('type');

    if (!channel.isTextBased()) {
      return interaction.reply({ content: '❌ Please select a text channel!', ephemeral: true });
    }

    const db = loadGuildChannels();
    db[interaction.guildId] = {
      channelId: channel.id,
      stockType: type
    };
    saveGuildChannels(db);

    await interaction.reply({
      content: `✅ Stock alerts set up in ${channel} for **${type.toUpperCase()}** stock!\nSending the initial current stock now...`,
      ephemeral: true
    });

    // Send immediate stock post right away upon setting
    const stockData = await getLiveStock();
    await sendStockUpdateToGuild(interaction.guildId, { channelId: channel.id, stockType: type }, stockData);
  }

  // Command: /remove-stock
  if (commandName === 'remove-stock') {
    const db = loadGuildChannels();
    if (db[interaction.guildId]) {
      delete db[interaction.guildId];
      saveGuildChannels(db);
      return interaction.reply({ content: '🛑 Automatic stock alerts disabled for this server.', ephemeral: true });
    }
    return interaction.reply({ content: '⚠️ Stock notifications were not configured for this server.', ephemeral: true });
  }

  // Command: /stock
  if (commandName === 'stock') {
    await interaction.deferReply();
    const stockData = await getLiveStock();
    const embed = buildStockEmbed(stockData, 'both');
    return interaction.editReply({ embeds: [embed] });
  }

  // Command: /bot-info
  if (commandName === 'bot-info') {
    const db = loadGuildChannels();
    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot Information')
      .setColor('#0099FF')
      .addFields(
        { name: 'Total Guilds', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Active Auto-Stock Channels', value: `${Object.keys(db).length}`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
      
