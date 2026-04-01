import { getConfigValue } from "./load-wrangler-vars.mjs";
import { DISCORD_COMMANDS } from "../src/discordCommands.js";

const applicationId = await getConfigValue("DISCORD_APPLICATION_ID");
const botToken = await getConfigValue("DISCORD_BOT_TOKEN");
const guildId = await getConfigValue("DISCORD_GUILD_ID");
const clearGlobal = process.env.DISCORD_CLEAR_GLOBAL === "1";

if (!applicationId) {
  console.error("DISCORD_APPLICATION_ID が設定されていません。");
  process.exit(1);
}

if (!botToken) {
  console.error("DISCORD_BOT_TOKEN が設定されていません。");
  process.exit(1);
}

const headers = {
  authorization: `Bot ${botToken}`,
  "content-type": "application/json",
};

if (clearGlobal) {
  const globalEndpoint = `https://discord.com/api/v10/applications/${applicationId}/commands`;
  const clearGlobalResponse = await fetch(globalEndpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify([]),
  });

  if (!clearGlobalResponse.ok) {
    const text = await clearGlobalResponse.text();
    console.error(`Global command の削除に失敗しました: ${clearGlobalResponse.status}`);
    console.error(text);
    process.exit(1);
  }

  console.log("Global command を全削除しました。");
}

const endpoint = guildId
  ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${applicationId}/commands`;

const response = await fetch(endpoint, {
  method: "PUT",
  headers,
  body: JSON.stringify(DISCORD_COMMANDS),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`コマンド同期に失敗しました: ${response.status}`);
  console.error(text);
  process.exit(1);
}

const payload = await response.json();
console.log(`${guildId ? "Guild" : "Global"} command を ${payload.length} 件同期しました。`);
