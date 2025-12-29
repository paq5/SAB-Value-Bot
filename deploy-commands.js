require("dotenv").config();
const { REST, Routes } = require("discord.js");
const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const commands = [
  new SlashCommandBuilder().setName("rules").setDescription("Trading rules & disclaimer"),

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

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Commands registered successfully!");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
    process.exit(1);
  }
})();
