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
  low: { mult: 0.85, emoji: "🧊" },
  medium: { mult: 1.0, emoji: "⚖️" },
  high: { mult: 1.15, emoji: "🔥" },
  insane: { mult: 1.3, emoji: "🚀" }
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
    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle("📜 Trading Rules")
        .setDescription("• Values can vary\n• Demand affects trades\n• Bot is a guide only")
        .setColor(0x5865F2)]
    });
  }

  if (i.commandName === "value") {
    const name = i.options.getString("name").toLowerCase();
    if (!data[name]) return i.reply({ content: "Unknown brainrot.", ephemeral: true });

    const b = data[name];
    const d = demandData[b.demand];
    const final = Math.round(b.value * d.mult);

    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle(`${b.icon} ${name}`)
        .addFields(
          { name: "Value", value: b.value.toString(), inline: true },
          { name: "Demand", value: `${b.demand.toUpperCase()} ${d.emoji}`, inline: true },
          { name: "Trade Value", value: final.toString(), inline: true }
        )
        .setColor(0x00ff99)]
    });
  }

  if (i.commandName === "tradecheck") {
    const parse = s => s.toLowerCase().split(",").map(x => x.trim());
    const calc = items => {
      let total = 0, lines = [];
      for (const it of items) {
        if (!data[it]) {
          lines.push(`• ${it} — ❓`);
          continue;
        }
        const b = data[it];
        const d = demandData[b.demand];
        const v = Math.round(b.value * d.mult);
        total += v;
        lines.push(`• ${b.icon} ${it} — ${b.value} | ${b.demand.toUpperCase()} ${d.emoji}`);
      }
      return { total, lines };
    };

    const your = calc(parse(i.options.getString("your_side")));
    const their = calc(parse(i.options.getString("their_side")));

    let result = "FAIR", emoji = "⚖️";
    if (your.total > their.total) { result = "WIN"; emoji = "✅"; }
    if (your.total < their.total) { result = "LOSE"; emoji = "❌"; }

    const embed = new EmbedBuilder()
      .setTitle("🧠 Trade Analysis")
      .addFields(
        { name: "Your Side", value: your.lines.join("\n") || "None", inline: true },
        { name: "Their Side", value: their.lines.join("\n") || "None", inline: true },
        { name: "Result", value: `${emoji} ${result} (${your.total - their.total})` }
      )
      .setColor(0x5865F2);

    await i.reply({ embeds: [embed] });

    if (config.tradeLogChannel) {
      const ch = await client.channels.fetch(config.tradeLogChannel).catch(() => null);
      if (ch) ch.send({ embeds: [embed.setFooter({ text: i.user.tag }).setTimestamp()] });
    }
  }

  if (i.commandName === "setvalue") {
    const name = i.options.getString("name").toLowerCase();
    const value = i.options.getInteger("value");
    data[name] ??= { demand: "medium", icon: "❓" };
    data[name].value = value;
    saveData(data);

    if (config.alertChannel) {
      const ch = await client.channels.fetch(config.alertChannel).catch(() => null);
      if (ch) ch.send(`📈 **${name}** value set to **${value}**`);
    }

    return i.reply("Value updated.");
  }

  if (i.commandName === "setdemand") {
    const name = i.options.getString("name").toLowerCase();
    const demand = i.options.getString("demand");
    data[name] ??= { value: 0, icon: "❓" };
    data[name].demand = demand;
    saveData(data);

    if (config.alertChannel) {
      const ch = await client.channels.fetch(config.alertChannel).catch(() => null);
      if (ch) ch.send(`🔥 **${name}** demand is now **${demand.toUpperCase()}**`);
    }

    return i.reply("Demand updated.");
  }

  if (i.commandName === "seticon") {
    const name = i.options.getString("name").toLowerCase();
    const icon = i.options.getString("icon");
    data[name] ??= { value: 0, demand: "medium" };
    data[name].icon = icon;
    saveData(data);
    return i.reply("Icon updated.");
  }

  if (i.commandName === "settradechannel") {
    config.tradeLogChannel = i.options.getChannel("channel").id;
    saveConfig(config);
    return i.reply("Trade log channel set.");
  }

  if (i.commandName === "setalertchannel") {
    config.alertChannel = i.options.getChannel("channel").id;
    saveConfig(config);
    return i.reply("Alert channel set.");
  }
});

client.login(process.env.TOKEN);
