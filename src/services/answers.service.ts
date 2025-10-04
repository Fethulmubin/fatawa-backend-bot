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
