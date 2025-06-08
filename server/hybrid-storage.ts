import { 
  users, type User, type InsertUser,
  submissions, type Submission, type InsertSubmission,
  logs, type Log, type InsertLog
} from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { IStorage } from "./storage";
import { mongoService } from "./mongodb";
import MongoStore from "connect-mongo";

export class HybridStorage implements IStorage {
  sessionStore: any;

  constructor() {
    // Use MongoDB for session storage
    this.sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || process.env.MONGO_URI,
      dbName: 'coding_lab_monitoring',
      collectionName: 'sessions',
      ttl: 24 * 60 * 60, // 24 hours
      autoRemove: 'native',
      touchAfter: 24 * 3600 // lazy session update
    });
  }

  // ==========================================
  // USER METHODS - PostgreSQL
  // ==========================================
  
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // ==========================================
  // SUBMISSION METHODS - PostgreSQL
  // ==========================================
  
  async getSubmissions(): Promise<Submission[]> {
    return await db.select().from(submissions);
  }

  async getSubmissionsByUserId(userId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.userId, userId));
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const [submission] = await db.insert(submissions).values(insertSubmission).returning();
    return submission;
  }

  // ==========================================
  // LOG METHODS - MongoDB
  // ==========================================
  
  async getLogs(): Promise<Log[]> {
    try {
      // Get logs from MongoDB and convert to PostgreSQL Log format
      const mongoLogs = await mongoService.getLogs();
      
      return mongoLogs.map(log => ({
        id: parseInt(log._id?.toString() || '0'), // Convert ObjectId to number
        userId: log.userId,
        type: log.type,
        data: typeof log.data === 'string' ? log.data : JSON.stringify(log.data),
        timestamp: log.createdAt
      }));
    } catch (error) {
      console.error('Error fetching logs from MongoDB:', error);
      return [];
    }
  }

  async getLogsByUserId(userId: number): Promise<Log[]> {
    try {
      const mongoLogs = await mongoService.getLogs(undefined, userId);
      
      return mongoLogs.map(log => ({
        id: parseInt(log._id?.toString() || '0'),
        userId: log.userId,
        type: log.type,
        data: typeof log.data === 'string' ? log.data : JSON.stringify(log.data),
        timestamp: log.createdAt
      }));
    } catch (error) {
      console.error('Error fetching user logs from MongoDB:', error);
      return [];
    }
  }

  async getLogsByType(type: string): Promise<Log[]> {
    try {
      const mongoLogs = await mongoService.getLogs(type);
      
      return mongoLogs.map(log => ({
        id: parseInt(log._id?.toString() || '0'),
        userId: log.userId,
        type: log.type,
        data: typeof log.data === 'string' ? log.data : JSON.stringify(log.data),
        timestamp: log.createdAt
      }));
    } catch (error) {
      console.error('Error fetching logs by type from MongoDB:', error);
      return [];
    }
  }

  async createLog(insertLog: InsertLog): Promise<Log> {
    try {
      // Save to MongoDB
      const mongoLog = await mongoService.saveLog({
        userId: insertLog.userId,
        type: insertLog.type,
        data: insertLog.data,
        timestamp: new Date().toISOString()
      });

      // Return in PostgreSQL Log format for compatibility
      return {
        id: parseInt(mongoLog._id?.toString() || '0'),
        userId: mongoLog.userId,
        type: mongoLog.type,
        data: typeof mongoLog.data === 'string' ? mongoLog.data : JSON.stringify(mongoLog.data),
        timestamp: mongoLog.createdAt
      };
    } catch (error) {
      console.error('Error creating log in MongoDB:', error);
      throw error;
    }
  }

  async deleteLogsByType(type: string): Promise<number> {
    try {
      // Delete logs of specific type from MongoDB
      const db = mongoService['db']; // Access private db property
      const collection = db.collection('logs');
      
      const result = await collection.deleteMany({ type: type });
      
      console.log(`🗑️ Deleted ${result.deletedCount} logs of type '${type}' from MongoDB`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('Error deleting logs by type from MongoDB:', error);
      throw error;
    }
  }

  async clearAllLogs(): Promise<number> {
    try {
      // Clear all logs from MongoDB
      const db = mongoService['db']; // Access private db property
      const collection = db.collection('logs');
      
      const result = await collection.deleteMany({});
      
      console.log(`🗑️ Cleared all ${result.deletedCount} logs from MongoDB`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('Error clearing all logs from MongoDB:', error);
      throw error;
    }
  }
}