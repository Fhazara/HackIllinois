import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = new PrismaClient(); // FORCING REFRESH

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
