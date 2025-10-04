import TelegramBot from "node-telegram-bot-api";
import { handleUserMessage } from "./handlers/userHandler";
import { handleAdminCallback, handleAdminMessage } from "./handlers/adminHandler";

console.log("🔹 Starting bot...");

const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });

bot.on("polling_error", (err) => {
  console.error("❌ Polling error:", err);
});

bot.on("message", async (msg) => {
  // console.log("📩 Incoming message:", msg.text, "from chat:", msg.chat.id);

  const chatId = msg.chat.id.toString();

   if (msg.chat.type !== "private" && chatId !== process.env.ADMIN_GROUP_ID!) {
    bot.sendMessage(chatId, "❌ Sorry, I am not allowed in this group.");
    await bot.leaveChat(chatId);
    return; // stop further processing
  }

  if (chatId === process.env.ADMIN_GROUP_ID) {
    // console.log("⚡ Message from admin group");
    await handleAdminMessage(bot, msg);
  } else if (msg.chat.type === "private") {
    // console.log("👤 Message from private user");
    await handleUserMessage(bot, msg);
  } else {
    // console.log("ℹ️ Message ignored:", msg.chat.type);
  }
});

bot.on("callback_query", async (query) => {
  await handleAdminCallback(bot, query);
});



export default bot;
