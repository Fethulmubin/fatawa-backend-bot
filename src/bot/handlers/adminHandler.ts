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
      `✍️ <b>@${
        query.from.username || "admin"
      }</b> is preparing an answer.\n\n📬 <b>Question ID:</b> #${questionId}\n\n💬 Please type your answer:`,
      { parse_mode: "HTML" }
    );
  }

  // 📌 Case 2: Update an answer
  else if (data.startsWith("update_answer_")) {
    const answerId = data.split("_")[2];
    activeAnswers.set(query.from.id, `update_${answerId}`);

    await bot.sendMessage(
      process.env.ADMIN_GROUP_ID!,
      `✏️ <b>@${
        query.from.username || "admin"
      }</b> is updating an answer.\n\n🆔 <b>Answer ID:</b> #${answerId}\n\n💬 Please type the new answer text:`,
      { parse_mode: "HTML" }
    );
  }

  // 📌 Case 3: Delete an answer
  else if (data.startsWith("delete_answer_")) {
    const answerId = data.split("_")[2];
    try {
      const answer = await deleteAnswer(answerId); // deletes from DB
      await deleteAnswerMessage(bot, answer);

      await bot.sendMessage(
        process.env.ADMIN_GROUP_ID!,
        `🗑️ <b>Answer Deleted Successfully</b>\n\n🆔 <b>Answer ID:</b> #${answerId}`,
        { parse_mode: "HTML" }
      );

      // Notify user about deletion
      const question = await getQuestionById(answer.questionId);
      if (question) {
        await bot.sendMessage(
          parseInt(question.user.telegramId),
          `❌ <b>Your Answer Has Been Deleted</b>\n\n📬 <b>Your Question:</b>\n<blockquote>❓ ${question.text}</blockquote>\n\n⚠️ <i>The admin has removed the answer related to this question.</i>`,
          { parse_mode: "HTML" }
        );
      }
    } catch (err) {
      console.error(err);
      await bot.sendMessage(
        process.env.ADMIN_GROUP_ID!,
        `❌ <b>Failed to Delete Answer</b>\n\n🆔 <b>Answer ID:</b> #${answerId}\n⚠️ Please check the logs for more details.`,
        { parse_mode: "HTML" }
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

      await bot.sendMessage(
        process.env.ADMIN_GROUP_ID!,
        `⏳ <b>Updating Answer</b>\n\n🆔 <b>Answer ID:</b> #${answerId}\n💬 Please wait...`,
        { parse_mode: "HTML" }
      );

      const updated = await updateAnswer(answerId, text); // updates DB
      activeAnswers.delete(adminId);

      // 🔹 delete old Telegram message, not DB record
      await deleteAnswerMessage(bot, updated);

      await bot.sendMessage(
        process.env.ADMIN_GROUP_ID!,
        `✅ <b>Answer Updated</b>\n\n🆔 <b>Answer ID:</b> #${answerId}\n👤 Updated by: @${
          msg.from?.username || "admin"
        }\n\n💡 <b>New Answer:</b>\n<blockquote>${updated.text}</blockquote>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Update Again",
                  callback_data: `update_answer_${answerId}`,
                },
                { text: "Delete", callback_data: `delete_answer_${answerId}` },
              ],
            ],
          },
        }
      );

      // 🔹 send updated answer to user
      const sentMsg = await bot.sendMessage(
        parseInt(updated.question.user.telegramId),
        `📬 <b>Your Question:</b>\n<blockquote>❓ ${updated.question.text}</blockquote>\n\n✅ <b>Updated Answer:</b>\n<blockquote>💡 ${updated.text}</blockquote>`,
        { parse_mode: "HTML" }
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
      await bot.sendMessage(
        process.env.ADMIN_GROUP_ID!,
        `❌ <b>Question Not Found</b>\n\n🆔 <b>Question ID:</b> #${questionId}\n⚠️ Please verify the ID and try again.`,
        { parse_mode: "HTML" }
      );

      return;
    }

    await bot.sendMessage(
      process.env.ADMIN_GROUP_ID!,
      `⏳ <b>Saving Answer</b>\n\n🆔 <b>Question ID:</b> #${questionId}\n💬 Please wait...`,
      { parse_mode: "HTML" }
    );

    const answer = await createAnswer(questionId, text);
    activeAnswers.delete(adminId);

    await bot.sendMessage(
      process.env.ADMIN_GROUP_ID!,
      `✅ <b>Answer Saved</b>\n\n🆔 <b>Question ID:</b> #${questionId}\n👤 Saved by: @${
        msg.from?.username || "admin"
      }\n\n💡 <b>Answer:</b>\n<blockquote>${answer.text}</blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Update", callback_data: `update_answer_${answer.id}` },
              { text: "Delete", callback_data: `delete_answer_${answer.id}` },
            ],
          ],
        },
      }
    );

    // Notify user privately
    const sentMsg = await bot.sendMessage(
      parseInt(question.user.telegramId),
      `📬 <b>Your Question:</b>\n<blockquote>${question.text}</blockquote>\n\n✅ <b>Answer:</b>\n<blockquote>${answer.text}</blockquote>`,
      { parse_mode: "HTML" }
    );

    await saveAnswerMessageMeta(answer.id, {
      chatId: question.user.telegramId,
      messageId: sentMsg.message_id,
    });
  } catch (err) {
    console.error("❌ Error handling admin message:", err);
  }
}
