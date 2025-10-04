import app from "./app";
import prisma from "./db";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Connect to the database
    await prisma.$connect();
    console.log("✅ Database connected");

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 SIGINT received. Disconnecting Prisma...");
      await prisma.$disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 SIGTERM received. Disconnecting Prisma...");
      await prisma.$disconnect();
      process.exit(0);
    });
  } catch (err) {
    console.error("❌ Could not connect to database", err);
    process.exit(1); // stop server if DB is unreachable
  }
}

// Start the server
startServer();
