import prisma from "../db";

export async function createQuestion(userId: string, text: string, username?: string) {
  return prisma.question.create({
    data: {
      text,
      user: {
        connectOrCreate: {
          where: { telegramId: userId },
          create: { telegramId: userId, username },
        },
      },
    },
    include: { user: true },
  });
}

export async function getAllQuestions() {
  return prisma.question.findMany({ include: { answer: true, user: true } });
}

export async function getQuestionById(id: string) {
  return prisma.question.findUnique({ where: { id }, include: { user: true } });
}
