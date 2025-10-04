import TelegramBot, { Message } from "node-telegram-bot-api";
import { createAnswer } from "../../services/answers.service";
import { getQuestionById } from "../../services/questions.service";

export const activeAnswers = new Map<number, string>();

export function handleAdminCallback(bot: TelegramBot, query: any) {
  if (!query.data?.startsWith("prepare_answer_")) return;

  const questionId = query.data.split("_")[2];

  // Save mapping between admin who clicked and the question
  // console.log(query.from.id, questionId);
  activeAnswers.set(query.from.id, questionId);

  bot.sendMessage(
    process.env.ADMIN_GROUP_ID!,
    `✍️ @${query.from.username || "admin"} is answering question #${questionId}. Please type your answer:`
  );
}


export async function handleAdminMessage(bot: TelegramBot, msg: TelegramBot.Message) {
  // console.log("⚡ Admin message received:", msg);
  const adminId = msg.from?.id;
  const text = msg.text;

  if (!adminId || !text) return;

  const activeQuestion = activeAnswers.get(adminId);
  if (!activeQuestion) return; // no active question for this admin

  try {
    const question = await getQuestionById(activeQuestion);
    if (!question) {
      bot.sendMessage(process.env.ADMIN_GROUP_ID!, `❌ Question ID ${activeQuestion} not found.`);
      return;
    }

    //saving the asnwer 
     bot.sendMessage(
      process.env.ADMIN_GROUP_ID!,
      `⏳ Saving answer for Question #${activeQuestion}...`
    );

    const answer = await createAnswer(activeQuestion, text);
    activeAnswers.delete(adminId);

    // ✅ Confirm in admin group
    bot.sendMessage(
      process.env.ADMIN_GROUP_ID!,
      `✅ Answer saved for Question #${activeQuestion} by @${msg.from?.username || "admin"}`
    );

    // 📩 Notify user
    bot.sendMessage(
      parseInt(question.user.telegramId),
      `📬 Your question: "${question.text}"\n✅ Answer: "${answer.text}"`
    );
  } catch (err) {
    console.error("❌ Error handling admin message:", err);
  }
}

