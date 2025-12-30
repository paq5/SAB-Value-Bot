require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
} = require("discord.js");

/* ================= BASIC SETUP ================= */

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const DATA_FILE = "./brainrots.json";
const OVERRIDE_FILE = "./overrides.json";
const CONFIG_FILE = "./config.json";

const WEBSITE_URL = "https://stealabrainrotvalue.com/";
const UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes

/* ================= FILE INIT ================= */

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
if (!fs.existsSync(OVERRIDE_FILE)) fs.writeFileSync(OVERRIDE_FILE, "{}");
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    tradeLogChannel: null,
    alertChannel: null
  }, null, 2));
}

const getData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = d => fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
const getOverrides = () => JSON.parse(fs.readFileSync(OVERRIDE_FILE));
const saveOverrides = o => fs.writeFileSync(OVERRIDE_FILE, JSON.stringify(o, null, 2));
const getConfig = () => JSON.parse(fs.readFileSync(CONFIG_FILE));
const saveConfig = c => fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));

/* ================= DEMAND DATA ================= */

const demandData = {
  low: { mult: 0.85, emoji: "🧊", color: 0x3498db },
  medium: { mult: 1.0, emoji: "⚖️", color: 0x95a5a6 },
  high: { mult: 1.15, emoji: "🔥", color: 0xe74c3c },
  insane: { mult: 1.3, emoji: "🚀", color: 0x9b59b6 }
};

/* ================= AUTO SCRAPER ================= */

async function fetchWebsiteValues() {
  try {
    const res = await axios.get(WEBSITE_URL, { timeout: 10000 });
    const $ = cheerio.load(res.data);

    const newData = {};
    
    $(".value-card").each((_, el) => {
      const name = $(el).find(".name").text().trim().toLowerCase();
      const value = parseInt($(el).find(".value").text().replace(/\D/g, ""));
      const demandText = $(el).find(".demand").text().toLowerCase();

      if (!name || !value) return;

      let demand = "medium";
      if (demandText.includes("low")) demand = "low";
      if (demandText.includes("high")) demand = "high";
      if (demandText.includes("insane")) demand = "insane";

      newData[name] = {
        value,
        demand,
        icon: "🧠",
        source: "auto"
      };
    });

    if (Object.keys(newData).length > 0) {
      compareAndUpdate(newData);
    }

  } catch (err) {
    console.log("⚠️ Website fetch failed, using cached values");
  }
}

/* ================= VALUE MERGE LOGIC ================= */

function compareAndUpdate(autoData) {
  const current = getData();
  const overrides = getOverrides();
  const config = getConfig();

  for (const name in autoData) {
    const auto = autoData[name];
    const manual = overrides[name];

    const finalValue = manual?.value ?? auto.value;
    const finalDemand = manual?.demand ?? auto.demand;

    if (
      !current[name] ||
      current[name].value !== finalValue ||
      current[name].demand !== finalDemand
    ) {
      current[name] = {
        value: finalValue,
        demand: finalDemand,
        icon: manual?.icon ?? current[name]?.icon ?? "🧠",
        source: manual ? "manual" : "auto"
      };

      if (config.alertChannel) {
        client.channels.fetch(config.alertChannel).then(ch => {
          ch.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("📈 Value Update")
                .setDescription(`**${name}** updated`)
                .addFields(
                  { name: "Value", value: `\`${finalValue}\``, inline: true },
                  { name: "Demand", value: `\`${finalDemand.toUpperCase()}\``, inline: true },
                  { name: "Source", value: manual ? "Manual Override" : "Website", inline: true }
                )
                .setColor(0x2ecc71)
                .setTimestamp()
            ]
          }).catch(() => {});
        });
      }
    }
  }

  saveData(current);
}

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all bot commands"),
  
  new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Trading rules & disclaimer"),
  
  new SlashCommandBuilder()
    .setName("value")
    .setDescription("Check a brainrot value")
    .addStringOption(o => 
      o.setName("name")
        .setDescription("The brainrot name to check")
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName("tradecheck")
    .setDescription("Check if a trade is fair")
    .addStringOption(o => 
      o.setName("your_side")
        .setDescription("Your items (comma separated)")
        .setRequired(true)
    )
    .addStringOption(o => 
      o.setName("their_side")
        .setDescription("Their items (comma separated)")
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName("setvalue")
    .setDescription("Override a brainrot value")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => 
      o.setName("name")
        .setDescription("The brainrot name")
        .setRequired(true)
    )
    .addIntegerOption(o => 
      o.setName("value")
        .setDescription("The new value")
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName("setdemand")
    .setDescription("Override demand level")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => 
      o.setName("name")
        .setDescription("The brainrot name")
        .setRequired(true)
    )
    .addStringOption(o => 
      o.setName("demand")
        .setDescription("The demand level")
        .setRequired(true)
        .addChoices(
          { name: "Low", value: "low" },
          { name: "Medium", value: "medium" },
          { name: "High", value: "high" },
          { name: "Insane", value: "insane" }
        )
    ),
  
  new SlashCommandBuilder()
    .setName("seticon")
    .setDescription("Override brainrot icon")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => 
      o.setName("name")
        .setDescription("The brainrot name")
        .setRequired(true)
    )
    .addStringOption(o => 
      o.setName("icon")
        .setDescription("The emoji icon")
        .setRequired(true)
    )
].map(c => c.toJSON());

/* ================= REGISTER ================= */

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log(`✅ Logged in as ${client.user.tag}`);
  fetchWebsiteValues();
  setInterval(fetchWebsiteValues, UPDATE_INTERVAL);
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  const data = getData();
  const overrides = getOverrides();

  if (i.commandName === "help") {
    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🧠 Brainrot Values Bot — Help")
          .setDescription(
            "**📊 Values**\n" +
            "`/value` `/tradecheck`\n\n" +
            "**🛠 Admin**\n" +
            "`/setvalue` `/setdemand` `/seticon`\n\n" +
            "**ℹ️ Info**\n" +
            "`/rules` `/help`"
          )
          .setColor(0x2c3e50)
      ]
    });
  }

  if (i.commandName === "rules") {
    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📋 Trading Rules & Disclaimer")
          .setDescription(
            "This bot provides value estimates based on market data.\n\n" +
            "**⚠️ Disclaimer:**\n" +
            "• Values are estimates and may change\n" +
            "• Always verify with current market\n" +
            "• Use at your own risk\n" +
            "• Admin can override values"
          )
          .setColor(0xe74c3c)
      ]
    });
  }

  if (i.commandName === "value") {
    const name = i.options.getString("name").toLowerCase();
    const item = data[name];

    if (!item) {
      return i.reply(`❌ **${name}** not found in database`);
    }

    const demand = demandData[item.demand];
    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${item.icon} ${name.toUpperCase()}`)
          .addFields(
            { name: "Value", value: `\`${item.value}\``, inline: true },
            { name: "Demand", value: `${demand.emoji} ${item.demand.toUpperCase()}`, inline: true },
            { name: "Source", value: item.source === "manual" ? "Manual Override" : "Website", inline: true }
          )
          .setColor(demand.color)
          .setTimestamp()
      ]
    });
  }

  if (i.commandName === "tradecheck") {
    const yourSide = i.options.getString("your_side").split(",").map(s => s.trim().toLowerCase());
    const theirSide = i.options.getString("their_side").split(",").map(s => s.trim().toLowerCase());

    let yourTotal = 0;
    let theirTotal = 0;
    let missingItems = [];

    for (const item of yourSide) {
      if (data[item]) yourTotal += data[item].value;
      else missingItems.push(item);
    }

    for (const item of theirSide) {
      if (data[item]) theirTotal += data[item].value;
      else missingItems.push(item);
    }

    let result = "Fair";
    let color = 0x95a5a6;

    if (yourTotal > theirTotal * 1.1) {
      result = "You're Winning";
      color = 0x2ecc71;
    } else if (theirTotal > yourTotal * 1.1) {
      result = "You're Losing";
      color = 0xe74c3c;
    }

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⚖️ Trade Check")
          .addFields(
            { name: "Your Side", value: `\`${yourTotal}\``, inline: true },
            { name: "Their Side", value: `\`${theirTotal}\``, inline: true },
            { name: "Result", value: result, inline: true }
          )
          .setColor(color)
          .setTimestamp()
          .setFooter({ text: missingItems.length > 0 ? `Unknown items: ${missingItems.join(", ")}` : "" })
      ]
    });
  }

  if (i.commandName === "setvalue") {
    const name = i.options.getString("name").toLowerCase();
    const value = i.options.getInteger("value");
    overrides[name] ??= {};
    overrides[name].value = value;
    saveOverrides(overrides);
    return i.reply(`✅ **${name}** value manually set to **${value}**`);
  }

  if (i.commandName === "setdemand") {
    const name = i.options.getString("name").toLowerCase();
    const demand = i.options.getString("demand");
    overrides[name] ??= {};
    overrides[name].demand = demand;
    saveOverrides(overrides);
    return i.reply(`🔥 **${name}** demand manually set to **${demand.toUpperCase()}**`);
  }

  if (i.commandName === "seticon") {
    const name = i.options.getString("name").toLowerCase();
    const icon = i.options.getString("icon");
    overrides[name] ??= {};
    overrides[name].icon = icon;
    saveOverrides(overrides);
    return i.reply(`🎨 **${name}** icon updated to ${icon}`);
  }
});

client.login(process.env.TOKEN);
