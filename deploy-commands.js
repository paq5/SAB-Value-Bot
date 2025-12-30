require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

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
    .addStringOption(o =>
      o.setName("name").setDescription("Brainrot name").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("value").setDescription("New value").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setdemand")
    .setDescription("Override demand")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o =>
      o.setName("name").setDescription("Brainrot name").setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("demand")
        .setDescription("Demand level")
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
    .addStringOption(o =>
      o.setName("name").setDescription("Brainrot name").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("icon").setDescription("Emoji icon").setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands
    });
    console.log("✅ Commands registered successfully!");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
    process.exit(1);
  }
})();
