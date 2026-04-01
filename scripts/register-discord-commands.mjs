import { DISCORD_COMMANDS } from "../src/discordCommands.js";

const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID ?? "";

if (!applicationId) {
  console.error("DISCORD_APPLICATION_ID が設定されていません。");
  process.exit(1);
}

if (!botToken) {
  console.error("DISCORD_BOT_TOKEN が設定されていません。");
  process.exit(1);
}

const endpoint = guildId
  ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${applicationId}/commands`;

const response = await fetch(endpoint, {
  method: "PUT",
  headers: {
    authorization: `Bot ${botToken}`,
    "content-type": "application/json",
  },
  body: JSON.stringify(DISCORD_COMMANDS),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`コマンド登録に失敗しました: ${response.status}`);
  console.error(text);
  process.exit(1);
}

const payload = await response.json();
console.log(`コマンドを ${payload.length} 件登録しました。`);
