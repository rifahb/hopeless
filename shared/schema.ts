import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  role: true
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Submission schema
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subject: text("subject").notNull(),
  code: text("code").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow()
});

export const insertSubmissionSchema = createInsertSchema(submissions).pick({
  userId: true,
  subject: true,
  code: true
});

export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissions.$inferSelect;

// Event logs schema
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // 'tab-switch' | 'screenshot' | 'screen-share'
  data: text("data"), // Optional data field for screenshots, etc.
  timestamp: timestamp("timestamp").notNull().defaultNow()
});

export const insertLogSchema = createInsertSchema(logs).pick({
  userId: true,
  type: true,
  data: true
});

export type InsertLog = z.infer<typeof insertLogSchema>;
export type Log = typeof logs.$inferSelect;

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export type LoginData = z.infer<typeof loginSchema>;

// Question schema
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  timeLimit: integer("time_limit").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertQuestionSchema = createInsertSchema(questions).pick({
  title: true,
  description: true,
  timeLimit: true
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;
