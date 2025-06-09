import { 
  users, type User, type InsertUser,
  submissions, type Submission, type InsertSubmission,
  logs, type Log, type InsertLog,
  questions, type Question, type InsertQuestion,
  grades, type Grade, type InsertGrade
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Modify the interface with CRUD methods needed
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Submission methods
  getSubmissions(): Promise<Submission[]>;
  getSubmissionsByUserId(userId: number): Promise<Submission[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  
  // Log methods
  getLogs(): Promise<Log[]>;
  getLogsByUserId(userId: number): Promise<Log[]>;
  getLogsByType(type: string): Promise<Log[]>;
  createLog(log: InsertLog): Promise<Log>;
  deleteLogsByType(type: string): Promise<number>;
  clearAllLogs(): Promise<number>;
  
  // Session store
  sessionStore: any; // Using any for session store type

  // Question methods
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestions(): Promise<Question[]>;
  getQuestionById(id: number): Promise<Question | null>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;

  // Grade methods
  createGrade(grade: InsertGrade): Promise<Grade>;
  getGrades(): Promise<Grade[]>;
  getGradesBySubmissionId(submissionId: number): Promise<Grade[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private submissions: Map<number, Submission>;
  private logs: Map<number, Log>;
  private grades: Map<number, Grade>;
  sessionStore: any; // Using any for session store type
  currentUserId: number;
  currentSubmissionId: number;
  currentLogId: number;
  currentGradeId: number;

  constructor() {
    this.users = new Map();
    this.submissions = new Map();
    this.logs = new Map();
    this.grades = new Map();
    this.currentUserId = 1;
    this.currentSubmissionId = 1;
    this.currentLogId = 1;
    this.currentGradeId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    
    // Seed initial user data
    this.createUser({
      email: "student@lab.com",
      password: "student123",
      role: "student"
    });
    
    this.createUser({
      email: "admin@lab.com",
      password: "admin123",
      role: "admin"
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Submission methods
  async getSubmissions(): Promise<Submission[]> {
    return Array.from(this.submissions.values());
  }

  async getSubmissionsByUserId(userId: number): Promise<Submission[]> {
    return Array.from(this.submissions.values()).filter(
      (submission) => submission.userId === userId
    );
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const id = this.currentSubmissionId++;
    const timestamp = new Date();
    const submission: Submission = { ...insertSubmission, id, timestamp };
    this.submissions.set(id, submission);
    return submission;
  }

  // Grade methods
  async createGrade(insertGrade: InsertGrade): Promise<Grade> {
    const id = this.currentGradeId++;
    const gradedAt = insertGrade.gradedAt || new Date();
    const grade: Grade = { ...insertGrade, id, gradedAt };
    this.grades.set(id, grade);
    return grade;
  }

  async getGrades(): Promise<Grade[]> {
    return Array.from(this.grades.values());
  }

  async getGradesBySubmissionId(submissionId: number): Promise<Grade[]> {
    return Array.from(this.grades.values()).filter(
      (grade) => grade.submissionId === submissionId
    );
  }

  // Log methods
  async getLogs(): Promise<Log[]> {
    return Array.from(this.logs.values());
  }

  async getLogsByUserId(userId: number): Promise<Log[]> {
    return Array.from(this.logs.values()).filter(
      (log) => log.userId === userId
    );
  }

  async getLogsByType(type: string): Promise<Log[]> {
    return Array.from(this.logs.values()).filter(
      (log) => log.type === type
    );
  }

  async createLog(insertLog: InsertLog): Promise<Log> {
    const id = this.currentLogId++;
    const timestamp = new Date();
    // Create a new object without spreading to avoid type issues
    const log: Log = { 
      id, 
      userId: insertLog.userId,
      type: insertLog.type,
      data: insertLog.data === undefined ? null : insertLog.data,
      timestamp
    };
    this.logs.set(id, log);
    return log;
  }

  async deleteLogsByType(type: string): Promise<number> {
    const toDelete = Array.from(this.logs.values()).filter(
      (log) => log.type === type
    );
    
    toDelete.forEach(log => this.logs.delete(log.id));
    
    return toDelete.length;
  }

  async clearAllLogs(): Promise<number> {
    const count = this.logs.size;
    this.logs.clear();
    return count;
  }

  // Question methods
  async createQuestion(question: InsertQuestion): Promise<Question> {
    throw new Error("Method not implemented");
  }

  async getQuestions(): Promise<Question[]> {
    throw new Error("Method not implemented");
  }

  async getQuestionById(id: number): Promise<Question | null> {
    throw new Error("Method not implemented");
  }

  async updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question> {
    throw new Error("Method not implemented");
  }

  async deleteQuestion(id: number): Promise<void> {
    throw new Error("Method not implemented");
  }
}

import { DatabaseStorage } from "./database-storage";
import { HybridStorage } from "./hybrid-storage";

// Use HybridStorage: PostgreSQL for users/submissions, MongoDB for logs/sessions
export const storage = new HybridStorage();