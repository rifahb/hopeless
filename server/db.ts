// database.ts or database-storage.ts

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema'; // keep this as-is if your schema is correct
import { questions } from "@shared/schema";
import { eq } from 'drizzle-orm';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.connect()
  .then(() => {
    console.log("Successfully connected to the database");
  })
  .catch((error) => {
    console.error("Error connecting to the database:", error);
  });

const db = drizzle(pool, { schema });

// Create tables if they don't exist
async function createTables() {
  try {
    // Test if questions table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'questions'
      );
    `);
    console.log("Questions table exists:", tableExists);

    if (!tableExists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS questions (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          time_limit INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Questions table created");
    }

    // Verify table structure
    const tableInfo = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'questions';
    `);
    console.log("Questions table structure:", tableInfo);
  } catch (error) {
    console.error("Error creating tables:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
}

async function verifyQuestionsTable() {
  try {
    // Check if table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'questions'
      );
    `);
    console.log("Questions table exists:", tableExists);

    if (!tableExists) {
      console.log("Creating questions table...");
      await db.execute(sql`
        CREATE TABLE questions (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          time_limit INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Questions table created");
    }

    // Verify table structure
    const columns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'questions'
      ORDER BY ordinal_position;
    `);
    console.log("Questions table structure:", columns);

    // Try to insert a test question
    try {
      const [testQuestion] = await db.insert(questions).values({
        title: "Test Question",
        description: "This is a test question",
        timeLimit: 30
      }).returning();
      console.log("Test question inserted successfully:", testQuestion);
      
      // Clean up test question
      await db.delete(questions).where(eq(questions.id, testQuestion.id));
      console.log("Test question deleted");
    } catch (error) {
      console.error("Error inserting test question:", error);
    }
  } catch (error) {
    console.error("Error verifying questions table:", error);
  }
}

// Call verifyQuestionsTable after creating tables
createTables().then(() => {
  verifyQuestionsTable();
});

export { db, pool };
