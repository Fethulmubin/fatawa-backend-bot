import prisma from "../db";

export async function createAnswer(questionId: string, text: string) {
  return prisma.answer.create({
    data: {
      text,
      question: { connect: { id: questionId } },
    },
    include: { question: { include: { user: true } } },
  });
}

export async function updateAnswer(answerId: string, newText: string) {
  return prisma.answer.update({
    where: { id: answerId },
    data: { text: newText },
    include: { question: { include: { user: true } } },
  });
  
}

export async function deleteAnswer(answerId: string) {
  return prisma.answer.delete({
    where: { id: answerId },
  });
}

  export async function saveAnswerMessageMeta(answerId: string, meta: { chatId: string, messageId: number }) {
  return prisma.answer.update({
    where: { id: answerId },
    data: {
      telegramChatId: meta.chatId,
      telegramMessageId: meta.messageId
    }
  });
}
