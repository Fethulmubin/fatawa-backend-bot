import TelegramBot from "node-telegram-bot-api";
import {
  createAnswer,
  updateAnswer,
  deleteAnswer,
  saveAnswerMessageMeta,
} from "../../services/answers.service";
import { getQuestionById } from "../../services/questions.service";

export const activeAnswers = new Map<number, string>();

// 🔹 Helper: delete old user message (but not DB record)
async function deleteAnswerMessage(bot: TelegramBot, answer: any) {
  if (answer?.telegramChatId && answer?.telegramMessageId) {
    try {
      await bot.deleteMessage(answer.telegramChatId, answer.telegramMessageId);
    } catch (err) {
      console.error("⚠️ Failed to delete user’s old message:", err);
    }
  }
}

export async function handleAdminCallback(bot: TelegramBot, query: any) {
  const data = query.data;
  if (!data) return;

  // 📌 Case 1: Prepare a new answer
  if (data.startsWith("prepare_answer_")) {
    const questionId = data.split("_")[2];
    activeAnswers.set(query.from.id, questionId);

    bot.sendMessage(
      process.env.ADMIN_GROUP_ID!,
      `✍️ @${query.from.username || "admin"} is answering question #${questionId}. Please type your answer:`
    );
  }

  // 📌 Case 2: Update an answer
  else if (data.startsWith("update_answer_")) {
    const answerId = data.split("_")[2];
    activeAnswers.set(query.from.id, `update_${answerId}`);

    bot.sendMessage(
      process.env.ADMIN_GROUP_ID!,
      `✏️ @${query.from.username || "admin"}: Please type the new answer text to update Answer #${answerId}.`
    );
  }

  // 📌 Case 3: Delete an answer
  else if (data.startsWith("delete_answer_")) {
    const answerId = data.split("_")[2];
    try {
      const answer = await deleteAnswer(answerId); // deletes from DB
      await deleteAnswerMessage(bot, answer);

      bot.sendMessage(
        process.env.ADMIN_GROUP_ID!,
        `🗑️ Answer #${answerId} deleted successfully.`
      );

      // Notify user about deletion
      const question = await getQuestionById(answer.questionId);
      if (question) {
        await bot.sendMessage(
          parseInt(question.user.telegramId),
          `❌ Your answer to the question: "${question.text}" has been deleted by the admin.`
        );
      }
    } catch (err) {
      console.error(err);
      bot.sendMessage(
        process.env.ADMIN_GROUP_ID!,
        `❌ Failed to delete Answer #${answerId}.`
      );
    }
  }
}

export async function handleAdminMessage(
  bot: TelegramBot,
  msg: TelegramBot.Message
) {
  const adminId = msg.from?.id;
  const text = msg.text;
  if (!adminId || !text) return;

  const activeTask = activeAnswers.get(adminId);
  if (!activeTask) return; // no active operation

  try {
    // 📌 Case: Updating an existing answer
    if (activeTask.startsWith("update_")) {
      const answerId = activeTask.split("_")[1];

      bot.sendMessage(process.env.ADMIN_GROUP_ID!, `⏳ Updating Answer #${answerId}...`);

      const updated = await updateAnswer(answerId, text); // updates DB
      activeAnswers.delete(adminId);

      // 🔹 delete old Telegram message, not DB record
      await deleteAnswerMessage(bot, updated);

      bot.sendMessage(
        process.env.ADMIN_GROUP_ID!,
        `✅ Answer #${answerId} updated by @${msg.from?.username || "admin"}\n\nNew Answer: "${updated.text}"`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✏️ Update Again", callback_data: `update_answer_${answerId}` },
                { text: "🗑️ Delete", callback_data: `delete_answer_${answerId}` },
              ],
            ],
          },
        }
      );

      // 🔹 send updated answer to user
      const sentMsg = await bot.sendMessage(
        parseInt(updated.question.user.telegramId),
        `📬 Your question: "${updated.question.text}"\n✅ Updated Answer: "${updated.text}"`
      );

      // 🔹 save new message meta
      await saveAnswerMessageMeta(updated.id, {
        chatId: updated.question.user.telegramId,
        messageId: sentMsg.message_id,
      });

      return;
    }

    // 📌 Case: Creating a new answer
    const questionId = activeTask;
    const question = await getQuestionById(questionId);

    if (!question) {
      bot.sendMessage(process.env.ADMIN_GROUP_ID!, `❌ Question ID ${questionId} not found.`);
      return;
    }

    bot.sendMessage(process.env.ADMIN_GROUP_ID!, `⏳ Saving answer for Question #${questionId}...`);
    const answer = await createAnswer(questionId, text);
    activeAnswers.delete(adminId);

    bot.sendMessage(
      process.env.ADMIN_GROUP_ID!,
      `✅ Answer saved for Question #${questionId} by @${msg.from?.username || "admin"}\n\nAnswer: "${answer.text}"`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✏️ Update", callback_data: `update_answer_${answer.id}` },
              { text: "🗑️ Delete", callback_data: `delete_answer_${answer.id}` },
            ],
          ],
        },
      }
    );

    // Notify user privately
    const sentMsg = await bot.sendMessage(
      parseInt(question.user.telegramId),
      `📬 Your question: "${question.text}"\n✅ Answer: "${answer.text}"`
    );

    await saveAnswerMessageMeta(answer.id, {
      chatId: question.user.telegramId,
      messageId: sentMsg.message_id,
    });
  } catch (err) {
    console.error("❌ Error handling admin message:", err);
  }
}
