import { prisma, disconnectDb } from '../src/config/database';

async function main() {
  try {
    console.log("Attempting prisma.transaction.deleteMany()...");
    await prisma.transaction.deleteMany();
    console.log("Success!");
  } catch (err: any) {
    console.error("FAILED WITH ERROR:");
    console.error("Name:", err.name);
    console.error("Message:", err.message);
    console.error("Code:", err.code);
    console.error("Meta:", err.meta);
    console.error("Full Error:", err);
  } finally {
    await disconnectDb();
  }
}

main();
