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

/* ===================== CLIENT ===================== */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ===================== FILES ===================== */

const DATA_FILE = "./brainrots.json";
const OVERRIDE_FILE = "./overrides.json";
const CONFIG_FILE = "./config.json";

const WEBSITE_URL = "https://stealabrainrotvalue.com/";
const UPDATE_INTERVAL = 10 * 60 * 1000;

/* ===================== INIT FILES ===================== */

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
if (!fs.existsSync(OVERRIDE_FILE)) fs.writeFileSync(OVERRIDE_FILE, "{}");
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify({ alertChannel: null }, null, 2)
  );
}

/* ===================== HELPERS ===================== */

const getData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = d => fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));

const getOverrides = () => JSON.parse(fs.readFileSync(OVERRIDE_FILE));
const saveOverrides = o =>
  fs.writeFileSync(OVERRIDE_FILE, JSON.stringify(o, null, 2));

const getConfig = () => JSON.parse(fs.readFileSync(CONFIG_FILE));

/* ===================== DEMAND VISUALS ===================== */

const demandInfo = {
  low: { emoji: "🧊", color: 0x3498db },
  medium: { emoji: "⚖️", color: 0x95a5a6 },
  high: { emoji: "🔥", color: 0xe74c3c },
  insane: { emoji: "🚀", color: 0x9b59b6 }
};

/* ===================== SCRAPER ===================== */

async function fetchWebsiteValues() {
  try {
    const res = await axios.get(WEBSITE_URL, { timeout: 10000 });
    const $ = cheerio.load(res.data);

    const scraped = {};

    $(".value-card").each((_, el) => {
      const name = $(el).find(".name").text().trim().toLowerCase();
      const value = parseInt(
        $(el).find(".value").text().replace(/\D/g, "")
      );
      const demandText = $(el).find(".demand").text().toLowerCase();

      if (!name || !value) return;

      let demand = "medium";
      if (demandText.includes("low")) demand = "low";
      if (demandText.includes("high")) demand = "high";
      if (demandText.includes("insane")) demand = "insane";

      scraped[name] = {
        value,
        demand,
        icon: "🧠",
        source: "auto"
      };
    });

    if (Object.keys(scraped).length) applyUpdates(scraped);
  } catch {
    console.log("⚠️ Website fetch failed, using cached data");
  }
}

/* ===================== UPDATE MERGE ===================== */

function applyUpdates(autoData) {
  const current = getData();
  const overrides = getOverrides();
  const config = getConfig();

  for (const name in autoData) {
    const auto = autoData[name];
    const manual = overrides[name];

    const final = {
      value: manual?.value ?? auto.value,
      demand: manual?.demand ?? auto.demand,
      icon: manual?.icon ?? current[name]?.icon ?? auto.icon,
      source: manual ? "manual" : "auto"
    };

    if (
      !current[name] ||
      current[name].value !== final.value ||
      current[name].demand !== final.demand
    ) {
      current[name] = final;

      if (config.alertChannel) {
        client.channels.fetch(config.alertChannel).then(ch => {
          ch.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("📈 Value Updated")
                .setDescription(`**${name}**`)
                .addFields(
                  { name: "Value", value: `\`${final.value}\``, inline: true },
                  {
                    name: "Demand",
                    value: `\`${final.demand.toUpperCase()}\``,
                    inline: true
                  },
                  {
                    name: "Source",
                    value: final.source === "manual" ? "Manual" : "Website",
                    inline: true
                  }
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

/* ===================== COMMANDS ===================== */

const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Show all commands"),
  new SlashCommandBuilder().setName("rules").setDescription("Trading rules"),

  new SlashCommandBuilder()
    .setName("value")
    .setDescription("Check a brainrot value")
    .addStringOption(o =>
      o.setName("name").setDescription("Brainrot name").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("tradecheck")
    .setDescription("Check trade fairness")
    .addStringOption(o =>
      o.setName("your_side").setDescription("Your items").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("their_side").setDescription("Their items").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setvalue")
    .setDescription("Override value")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("name").setRequired(true))
    .addIntegerOption(o => o.setName("value").setRequired(true)),

  new SlashCommandBuilder()
    .setName("setdemand")
    .setDescription("Override demand")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("name").setRequired(true))
    .addStringOption(o =>
      o
        .setName("demand")
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
    .setDescription("Override icon")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("name").setRequired(true))
    .addStringOption(o => o.setName("icon").setRequired(true))
].map(c => c.toJSON());

/* ===================== REGISTER ===================== */

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log("✅ Commands registered");
}

/* ===================== EVENTS ===================== */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
  fetchWebsiteValues();
  setInterval(fetchWebsiteValues, UPDATE_INTERVAL);
});

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  const data = getData();
  const overrides = getOverrides();

  /* ===== HELP ===== */
  if (i.commandName === "help") {
    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🧠 Brainrot Values Bot")
          .setDescription(
            "**Public Commands**\n" +
              "`/value` – Check a value\n" +
              "`/tradecheck` – Trade fairness\n\n" +
              "**Admin Commands**\n" +
              "`/setvalue` – Override value\n" +
              "`/setdemand` – Override demand\n" +
              "`/seticon` – Override icon"
          )
          .setColor(0x2c3e50)
      ]
    });
  }

  /* ===== RULES ===== */
  if (i.commandName === "rules") {
    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📋 Trading Rules")
          .setDescription(
            "• Values are estimates\n" +
              "• Demand is **visual only**\n" +
              "• Admin overrides always win\n" +
              "• Trade at your own risk"
          )
          .setColor(0xe74c3c)
      ]
    });
  }

  /* ===== VALUE ===== */
  if (i.commandName === "value") {
    const name = i.options.getString("name").toLowerCase();
    const item = data[name];
    if (!item) return i.reply("❌ Not found");

    const d = demandInfo[item.demand] ?? demandInfo.medium;

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${item.icon} ${name.toUpperCase()}`)
          .addFields(
            { name: "Value", value: `\`${item.value}\``, inline: true },
            {
              name: `${d.emoji} Demand`,
              value: item.demand.toUpperCase(),
              inline: true
            },
            {
              name: "Source",
              value: item.source === "manual" ? "Manual" : "Website",
              inline: true
            }
          )
          .setColor(d.color)
      ]
    });
  }

  /* ===== TRADECHECK ===== */
  if (i.commandName === "tradecheck") {
    const your = i.options
      .getString("your_side")
      .split(",")
      .map(s => s.trim().toLowerCase());
    const their = i.options
      .getString("their_side")
      .split(",")
      .map(s => s.trim().toLowerCase());

    let yourTotal = 0;
    let theirTotal = 0;

    your.forEach(i => data[i] && (yourTotal += data[i].value));
    their.forEach(i => data[i] && (theirTotal += data[i].value));

    let result = "⚖️ Fair";
    let color = 0x95a5a6;

    if (yourTotal > theirTotal * 1.1) {
      result = "🟢 You're Winning";
      color = 0x2ecc71;
    } else if (theirTotal > yourTotal * 1.1) {
      result = "🔴 You're Losing";
      color = 0xe74c3c;
    }

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⚖️ Trade Result")
          .addFields(
            { name: "Your Side", value: `${yourTotal}`, inline: true },
            { name: "Their Side", value: `${theirTotal}`, inline: true },
            { name: "Result", value: result }
          )
          .setColor(color)
      ]
    });
  }

  /* ===== ADMIN ===== */
  if (["setvalue", "setdemand", "seticon"].includes(i.commandName)) {
    const name = i.options.getString("name").toLowerCase();
    overrides[name] ??= {};

    if (i.commandName === "setvalue")
      overrides[name].value = i.options.getInteger("value");

    if (i.commandName === "setdemand")
      overrides[name].demand = i.options.getString("demand");

    if (i.commandName === "seticon")
      overrides[name].icon = i.options.getString("icon");

    saveOverrides(overrides);
    return i.reply("✅ Updated");
  }
});

client.login(process.env.TOKEN);
