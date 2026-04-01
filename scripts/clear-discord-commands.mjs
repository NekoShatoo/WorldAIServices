import { getConfigValue } from "./load-local-config.mjs";

const applicationId = await getConfigValue("DISCORD_APPLICATION_ID");
const botToken = await getConfigValue("DISCORD_BOT_TOKEN");
const guildId = await getConfigValue("DISCORD_GUILD_ID");

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
  body: JSON.stringify([]),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`コマンド削除に失敗しました: ${response.status}`);
  console.error(text);
  process.exit(1);
}

console.log(guildId ? "Guild command を全削除しました。" : "Global command を全削除しました。");
