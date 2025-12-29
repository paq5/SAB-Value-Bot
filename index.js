require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
} = require("discord.js");

/* ================= SETUP ================= */

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const DATA_FILE = "./brainrots.json";
const CONFIG_FILE = "./config.json";

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    garama: { value: 2100, demand: "high", icon: "🧠" }
  }, null, 2));
}

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    tradeLogChannel: null,
    alertChannel: null
  }, null, 2));
}

const getData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = d => fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
const getConfig = () => JSON.parse(fs.readFileSync(CONFIG_FILE));
const saveConfig = c => fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));

const demandData = {
  low: { mult: 0.85, emoji: "🧊", color: 0x3498db, bar: "▰▰▰░░░░░░" },
  medium: { mult: 1.0, emoji: "⚖️", color: 0x95a5a6, bar: "▰▰▰▰▰░░░░" },
  high: { mult: 1.15, emoji: "🔥", color: 0xe74c3c, bar: "▰▰▰▰▰▰▰░░" },
  insane: { mult: 1.3, emoji: "🚀", color: 0x9b59b6, bar: "▰▰▰▰▰▰▰▰▰▰" }
};

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Trading rules & disclaimer"),

  new SlashCommandBuilder()
    .setName("value")
    .setDescription("Check a brainrot value")
    .addStringOption(o => o.setName("name").setRequired(true).setDescription("Name of the brainrot")),

  new SlashCommandBuilder()
    .setName("tradecheck")
    .setDescription("Check a trade")
    .addStringOption(o => o.setName("your_side").setRequired(true).setDescription("Your items (comma-separated)"))
    .addStringOption(o => o.setName("their_side").setRequired(true).setDescription("Their items (comma-separated)")),

  new SlashCommandBuilder()
    .setName("setvalue")
    .setDescription("Set a brainrot value")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("name").setRequired(true).setDescription("Name of the brainrot"))
    .addIntegerOption(o => o.setName("value").setRequired(true).setDescription("Value to set")),

  new SlashCommandBuilder()
    .setName("setdemand")
    .setDescription("Set a brainrot demand")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("name").setRequired(true).setDescription("Name of the brainrot"))
    .addStringOption(o => o.setName("demand").setRequired(true).setDescription("Demand level")
      .addChoices(
        { name: "Low", value: "low" },
        { name: "Medium", value: "medium" },
        { name: "High", value: "high" },
        { name: "Insane", value: "insane" }
      )),

  new SlashCommandBuilder()
    .setName("seticon")
    .setDescription("Set a brainrot icon")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("name").setRequired(true).setDescription("Name of the brainrot"))
    .addStringOption(o => o.setName("icon").setRequired(true).setDescription("Emoji icon")),

  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a brainrot")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("name").setRequired(true).setDescription("Name of the brainrot to remove")),

  new SlashCommandBuilder()
    .setName("totalvalues")
    .setDescription("Show all brainrots with detailed values"),

  new SlashCommandBuilder()
    .setName("allbrainrots")
    .setDescription("Show all brainrots currently on the server"),

  new SlashCommandBuilder()
    .setName("settradechannel")
    .setDescription("Set trade log channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName("channel").setRequired(true).setDescription("Channel for trade logs")),

  new SlashCommandBuilder()
    .setName("setalertchannel")
    .setDescription("Set value/demand alert channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName("channel").setRequired(true).setDescription("Channel for alerts"))
].map(c => c.toJSON());

/* ================= REGISTER COMMANDS ================= */

async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Commands registered successfully");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
}

/* ================= LOGIC ================= */

client.on("ready", () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  registerCommands();
});

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  const data = getData();
  const config = getConfig();

  if (i.commandName === "rules") {
    const rulesEmbed = new EmbedBuilder()
      .setTitle("📜 Trading Rules & Disclaimer")
      .setDescription("Read these rules carefully before trading!")
      .addFields(
        { name: "⚠️ Rule 1: Values Can Vary", value: "Prices fluctuate based on market demand and rarity. Use this bot as a guide, not gospel.", inline: false },
        { name: "📊 Rule 2: Demand Affects Trades", value: "High demand items are worth more. Low demand items are worth less. Always check the demand level!", inline: false },
        { name: "🤖 Rule 3: Bot is a Guide Only", value: "This bot provides estimates. Final trade decisions are yours. Trade responsibly!", inline: false },
        { name: "💡 Pro Tip", value: "Always verify both sides of a trade using `/tradecheck` before confirming!", inline: false }
      )
      .setColor(0x2c3e50)
      .setFooter({ text: "Stay safe and trade smart! 🚀" })
      .setTimestamp();

    return i.reply({ embeds: [rulesEmbed] });
  }

  if (i.commandName === "value") {
    const name = i.options.getString("name").toLowerCase();
    if (!data[name]) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Brainrot Not Found")
        .setDescription(`"${name}" is not in the database. Check the spelling and try again!`)
        .setColor(0xe74c3c)
        .setFooter({ text: "Use /setvalue to add new brainrots" });
      return i.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    const b = data[name];
    const d = demandData[b.demand];
    const final = Math.round(b.value * d.mult);

    const valueEmbed = new EmbedBuilder()
      .setTitle(`${b.icon} ${name.toUpperCase()}`)
      .setColor(d.color)
      .addFields(
        { name: "💰 Base Value", value: `\`${b.value}\``, inline: true },
        { name: `${d.emoji} Demand Level`, value: `\`${b.demand.toUpperCase()}\``, inline: true },
        { name: "📈 Multiplier", value: `\`${d.mult}x\``, inline: true },
        { name: "🎯 Trade Value", value: `\`${final}\``, inline: false },
        { name: "Demand Bar", value: d.bar, inline: false }
      )
      .setFooter({ text: "Trade value = Base value × Demand multiplier" })
      .setTimestamp();

    return i.reply({ embeds: [valueEmbed] });
  }

  if (i.commandName === "tradecheck") {
    const parse = s => s.toLowerCase().split(",").map(x => x.trim());
    const calc = items => {
      let total = 0, lines = [];
      for (const it of items) {
        if (!data[it]) {
          lines.push(`❓ \`${it}\` — Unknown`);
          continue;
        }
        const b = data[it];
        const d = demandData[b.demand];
        const v = Math.round(b.value * d.mult);
        total += v;
        lines.push(`${b.icon} \`${it}\` — **${v}** (${b.value} × ${d.mult}x)`);
      }
      return { total, lines };
    };

    const your = calc(parse(i.options.getString("your_side")));
    const their = calc(parse(i.options.getString("their_side")));

    const difference = your.total - their.total;
    let result = "FAIR", emoji = "⚖️", color = 0x95a5a6;
    
    if (difference > 0) { result = "WIN"; emoji = "✅"; color = 0x2ecc71; }
    if (difference < 0) { result = "LOSE"; emoji = "❌"; color = 0xe74c3c; }

    const tradeEmbed = new EmbedBuilder()
      .setTitle(`${emoji} Trade Analysis`)
      .setColor(color)
      .addFields(
        { name: "👤 Your Side", value: your.lines.join("\n") || "None", inline: true },
        { name: "🤝 Their Side", value: their.lines.join("\n") || "None", inline: true },
        { name: "━━━━━━━━━━━━━━━━", value: "━━━━━━━━━━━━━━━━", inline: false },
        { name: "Your Total", value: `\`${your.total}\``, inline: true },
        { name: "Their Total", value: `\`${their.total}\``, inline: true },
        { name: "Difference", value: `\`${Math.abs(difference)}\``, inline: true },
        { name: "Result", value: `**${result}** — ${difference > 0 ? `You gain **${difference}** value` : difference < 0 ? `You lose **${Math.abs(difference)}** value` : "Both sides are equal"}`, inline: false }
      )
      .setFooter({ text: "Always verify before trading!" })
      .setTimestamp();

    await i.reply({ embeds: [tradeEmbed] });

    if (config.tradeLogChannel) {
      const ch = await client.channels.fetch(config.tradeLogChannel).catch(() => null);
      if (ch) ch.send({ embeds: [tradeEmbed.setFooter({ text: `Trade checked by ${i.user.tag}` })] });
    }
  }

  if (i.commandName === "setvalue") {
    const name = i.options.getString("name").toLowerCase();
    const value = i.options.getInteger("value");
    data[name] ??= { demand: "medium", icon: "❓" };
    data[name].value = value;
    saveData(data);

    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Value Updated")
      .setColor(0x2ecc71)
      .addFields(
        { name: "Brainrot", value: `\`${name}\``, inline: true },
        { name: "New Value", value: `\`${value}\``, inline: true }
      )
      .setTimestamp();

    if (config.alertChannel) {
      const ch = await client.channels.fetch(config.alertChannel).catch(() => null);
      if (ch) ch.send({ embeds: [new EmbedBuilder()
        .setTitle("📈 Value Alert")
        .setDescription(`**${name}** value has been updated to **${value}**`)
        .setColor(0x3498db)
        .setTimestamp()] });
    }

    return i.reply({ embeds: [successEmbed] });
  }

  if (i.commandName === "setdemand") {
    const name = i.options.getString("name").toLowerCase();
    const demand = i.options.getString("demand");
    data[name] ??= { value: 0, icon: "❓" };
    data[name].demand = demand;
    saveData(data);

    const d = demandData[demand];
    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Demand Updated")
      .setColor(d.color)
      .addFields(
        { name: "Brainrot", value: `\`${name}\``, inline: true },
        { name: `${d.emoji} New Demand`, value: `\`${demand.toUpperCase()}\``, inline: true },
        { name: "Multiplier", value: `\`${d.mult}x\``, inline: true }
      )
      .setTimestamp();

    if (config.alertChannel) {
      const ch = await client.channels.fetch(config.alertChannel).catch(() => null);
      if (ch) ch.send({ embeds: [new EmbedBuilder()
        .setTitle("🔥 Demand Alert")
        .setDescription(`**${name}** demand is now **${demand.toUpperCase()}** ${d.emoji}`)
        .setColor(d.color)
        .setTimestamp()] });
    }

    return i.reply({ embeds: [successEmbed] });
  }

  if (i.commandName === "seticon") {
    const name = i.options.getString("name").toLowerCase();
    const icon = i.options.getString("icon");
    data[name] ??= { value: 0, demand: "medium" };
    data[name].icon = icon;
    saveData(data);

    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Icon Updated")
      .setColor(0x2ecc71)
      .addFields(
        { name: "Brainrot", value: `\`${name}\``, inline: true },
        { name: "New Icon", value: `${icon}`, inline: true }
      )
      .setTimestamp();

    return i.reply({ embeds: [successEmbed] });
  }

  if (i.commandName === "remove") {
    const name = i.options.getString("name").toLowerCase();
    if (!data[name]) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Brainrot Not Found")
        .setDescription(`"${name}" is not in the database. Nothing to remove!`)
        .setColor(0xe74c3c);
      return i.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    const removedBrainrot = data[name];
    delete data[name];
    saveData(data);

    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Brainrot Removed")
      .setColor(0x2ecc71)
      .addFields(
        { name: "Removed", value: `\`${name}\``, inline: true },
        { name: "Icon", value: `${removedBrainrot.icon}`, inline: true }
      )
      .setDescription(`**${name}** has been successfully removed from the database.`)
      .setTimestamp();

    return i.reply({ embeds: [successEmbed] });
  }

  if (i.commandName === "totalvalues") {
    const brainrots = Object.entries(data);
    
    if (brainrots.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle("📊 Brainrot Database")
        .setDescription("The database is empty! Use `/setvalue` to add brainrots.")
        .setColor(0x95a5a6);
      return i.reply({ embeds: [emptyEmbed] });
    }

    let totalValue = 0;
    const fields = [];

    brainrots.forEach(([name, b]) => {
      const d = demandData[b.demand];
      const tradeValue = Math.round(b.value * d.mult);
      totalValue += tradeValue;
      
      fields.push({
        name: `${b.icon} ${name.toUpperCase()}`,
        value: `Base: \`${b.value}\` | Demand: \`${b.demand.toUpperCase()}\` ${d.emoji} | Trade: \`${tradeValue}\``,
        inline: false
      });
    });

    const totalEmbed = new EmbedBuilder()
      .setTitle("📊 All Brainrots")
      .setColor(0x3498db)
      .addFields(...fields)
      .addFields(
        { name: "━━━━━━━━━━━━━━━━", value: "━━━━━━━━━━━━━━━━", inline: false },
        { name: "📈 Total Trade Value", value: `\`${totalValue}\``, inline: true },
        { name: "🔢 Total Items", value: `\`${brainrots.length}\``, inline: true }
      )
      .setFooter({ text: "Total trade value = Sum of all trade values" })
      .setTimestamp();

    return i.reply({ embeds: [totalEmbed] });
  }

  if (i.commandName === "allbrainrots") {
    const brainrots = Object.entries(data);
    
    if (brainrots.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle("📋 All Brainrots")
        .setDescription("The database is empty! Use `/setvalue` to add brainrots.")
        .setColor(0x95a5a6);
      return i.reply({ embeds: [emptyEmbed] });
    }

    let brainrotList = "";
    brainrots.forEach(([name, b]) => {
      brainrotList += `${b.icon} **${name}** — Base: \`${b.value}\` | Demand: \`${b.demand.toUpperCase()}\`\n`;
    });

    const allBrainrotsEmbed = new EmbedBuilder()
      .setTitle("📋 All Brainrots on Server")
      .setDescription(brainrotList)
      .setColor(0x9b59b6)
      .addFields(
        { name: "Total Brainrots", value: `\`${brainrots.length}\``, inline: true }
      )
      .setFooter({ text: "Use /value <name> to check individual values" })
      .setTimestamp();

    return i.reply({ embeds: [allBrainrotsEmbed] });
  }

  if (i.commandName === "settradechannel") {
    config.tradeLogChannel = i.options.getChannel("channel").id;
    saveConfig(config);

    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Trade Log Channel Set")
      .setColor(0x2ecc71)
      .setDescription(`Trade logs will now be sent to <#${config.tradeLogChannel}>`)
      .setTimestamp();

    return i.reply({ embeds: [successEmbed] });
  }

  if (i.commandName === "setalertchannel") {
    config.alertChannel = i.options.getChannel("channel").id;
    saveConfig(config);

    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Alert Channel Set")
      .setColor(0x2ecc71)
      .setDescription(`Value and demand alerts will now be sent to <#${config.alertChannel}>`)
      .setTimestamp();

    return i.reply({ embeds: [successEmbed] });
  }
});

client.login(process.env.TOKEN);
