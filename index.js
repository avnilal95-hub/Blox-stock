require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  REST, 
  Routes 
} = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Channel ID to post updates (Can be overridden dynamically via /set-stock command)
let stockChannelId = process.env.CHANNEL_ID || null;
let previousStock = [];

// Custom Discord Emoji Mapping for Blox Fruits
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

// 1. Slash Command Definition (/set-stock channel:)
const commands = [
  new SlashCommandBuilder()
    .setName('set-stock')
    .setDescription('Sets the channel where Blox Fruits stock notifications will be posted.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Select the target text channel')
        .setRequired(true)
    )
];

// 2. Register Slash Commands with Discord Gateway
async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    console.log('Registering slash commands...');
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('✅ Registered /set-stock slash command successfully!');
  } catch (error) {
    console.error('Error registering slash commands:', error.message);
  }
}

// 3. Stock Checker Function
async function checkStock() {
  if (!stockChannelId) {
    console.log('⚠️ No target channel ID set. Run /set-stock channel: in Discord!');
    return;
  }

  const options = {
    method: 'GET',
    url: 'https://blox-fruit-stock-fruit.p.rapidapi.com/',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'blox-fruit-stock-fruit.p.rapidapi.com',
      'x-rapidapi-key': process.env.RAPIDAPI_KEY
    }
  };

  try {
    const response = await axios.request(options);
    const stockData = response.data;
    const currentFruits = Array.isArray(stockData) ? stockData : (stockData.fruits || stockData.stock || []);

    if (currentFruits.length === 0) return;

    const currentStockNames = currentFruits.map(item => item.name || item);
    const hasChanged = JSON.stringify(currentStockNames) !== JSON.stringify(previousStock);

    if (hasChanged) {
      previousStock = currentStockNames;

      const channel = await client.channels.fetch(stockChannelId);
      if (!channel) return;

      // Formatting: {Fruit_img} : {fruit_prize} - {fruit_name}
      const stockLines = currentFruits.map(fruit => {
        const fruitName = fruit.name || fruit;
        const fruitImg = FRUIT_EMOJIS[fruitName] || '🍎'; 
        const fruitPrice = fruit.price ? `$${fruit.price.toLocaleString()}` : 'In Stock';

        return `${fruitImg} : ${fruitPrice} - ${fruitName}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Blox Fruits Dealer Stock Update')
        .setColor('#00FF7F')
        .setTimestamp()
        .setDescription(stockLines);

      await channel.send({ embeds: [embed] });
      console.log(`Posted stock update to channel: ${stockChannelId}`);
    }
  } catch (error) {
    console.error('RapidAPI Fetch Error:', error.response ? error.response.data : error.message);
  }
}

// 4. Handle Command Interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'set-stock') {
    const selectedChannel = interaction.options.getChannel('channel');
    stockChannelId = selectedChannel.id;

    await interaction.reply({
      content: `✅ Blox Fruits stock alerts will now post to ${selectedChannel}!`,
      ephemeral: true
    });

    // Check stock immediately for the newly selected channel
    checkStock();
  }
});

// 5. Bot Startup Logic
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  await registerCommands();

  // Run stock check immediately on launch, then loop every 15 minutes
  checkStock();
  setInterval(checkStock, 15 * 60 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
                                                                  
