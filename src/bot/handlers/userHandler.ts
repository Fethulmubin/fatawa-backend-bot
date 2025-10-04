import TelegramBot, { Message } from "node-telegram-bot-api";
import { createQuestion } from "../../services/questions.service";

export async function handleUserMessage(bot: TelegramBot, msg: Message) {
  const chatId = msg.chat.id;
  const text = msg.text || "";

   if (text === "/start") {
    bot.sendMessage(chatId, "Welcome to Darul Fatawa al-Najashi! Choose an option:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📝 My Questions", web_app: { url: "https://www.yourapp.com/myquestions" } },
            { text: "🌐 All Questions", web_app: { url: "https://www.yourapp.com/allquestions" } }
          ],
          [
            { text: "❓ Help", web_app: { url: "https://www.yourapp.com/help" } }
          ],
          [
            { text: "Ask new question", callback_data: "ask_new_question" }
          ]
        ]
      }
    });
    return; 
  }

  // Use fallback for username and id
  const userId = msg.from?.id?.toString();
  const username = msg.from?.username || "user";

  // console.log("💬 User sent:", text, "from:", username);

  if (!userId) {
    // console.error("❌ msg.from is undefined, cannot save question");
    bot.sendMessage(chatId, "❌ Cannot identify you. Please try again.");
    return;
  }

  try {

    //sending to database indicator
     bot.sendMessage(
      chatId,
      `⏳ Submitting your question...`
    );

    const question = await createQuestion(userId, text, username);
    // console.log("✅ Question saved:", question.id);

    bot.sendMessage(
      chatId,
      `✅ Your question has been submitted. Question ID: ${question.id}`
    );

    const adminGroupId = process.env.ADMIN_GROUP_ID!;
    bot.sendMessage(
      adminGroupId,
      `📩 New Question (#${question.id}) from @${username}:\n${text}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✍️ Answer",
                callback_data: `prepare_answer_${question.id}`,
              },
            ],
          ],
        },
      }
    );
    // console.log("📨 Forwarded to admin group:", adminGroupId);
  } catch (err) {
    // console.error("❌ Error saving question:", err);
    bot.sendMessage(
      chatId,
      "❌ Failed to submit your question. Try again later."
    );
  }
}
