import { prisma } from "../src/app/lib/prisma";

async function main() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imageEmbedding" double precision[] DEFAULT ARRAY[]::double precision[];`
    );
    console.log("Successfully ensured imageEmbedding column exists in products table.");
  } catch (error) {
    console.error("Error ensuring imageEmbedding column:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
