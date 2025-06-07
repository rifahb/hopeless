import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { spinUpContainer, stopContainer } from "./container-manager";
import { 
  insertSubmissionSchema,
  insertLogSchema 
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Middleware to check if user is authenticated
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Middleware to check user role
  const checkRole = (role: string) => (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user?.role === role) {
      return next();
    }
    res.status(403).json({ message: "Forbidden" });
  };
  
  // Protected routes for students
  app.get("/api/student/dashboard", isAuthenticated, checkRole("student"), (req, res) => {
    res.json({ message: "Student dashboard" });
  });
  
  // Protected routes for admins
  app.get("/api/admin/dashboard", isAuthenticated, checkRole("admin"), (req, res) => {
    res.json({ message: "Admin dashboard" });
  });
  
  // Code submissions endpoint
  app.post("/api/submit", isAuthenticated, async (req, res) => {
    try {
      const submission = insertSubmissionSchema.parse({
        userId: req.user?.id,
        subject: req.body.subject,
        code: req.body.code
      });
      
      const result = await storage.createSubmission(submission);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid submission data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to submit code" });
      }
    }
  });
  
  // Grade submission endpoint for admins
  app.post("/api/admin/grade", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      // Validate request body
      const { submissionId, score, feedback } = req.body;
      
      if (typeof submissionId !== 'number' || typeof score !== 'number' || typeof feedback !== 'string') {
        return res.status(400).json({ message: "Invalid grade data" });
      }
      
      // In a real implementation, you would save this to a grades table
      // For this demo, we'll just return success
      console.log(`Grade submitted for submission ${submissionId}: score=${score}, feedback=${feedback}`);
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit grade" });
    }
  });
  
  // Get student grades by email (admin only)
  app.get("/api/admin/grades/:email", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      // In a real implementation, you would fetch from database
      // For demo, return mock data
      const studentEmail = req.params.email;
      console.log(`Fetching grades for student: ${studentEmail}`);
      
      // This would normally come from database
      res.json([
        {
          id: 1,
          submissionId: 1,
          userId: 1,
          score: 85,
          feedback: "Good solution but could be optimized further",
          subject: "javascript",
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch grades" });
    }
  });
  
  // Get all active screen shares (admin only)
  app.get("/api/admin/screen-shares", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      // This would normally query a collection of active streams
      // For demo, return information about how screen sharing works
      res.json({
        message: "Screen sharing implementation details",
        note: "This system uses a screenshot-based approach rather than WebRTC",
        details: [
          "Screenshots are captured by html2canvas on client",
          "Images are stored as base64 in the logs collection",
          "They can be viewed from the admin logs section",
          "For real-time WebRTC, you would need a media server like Janus or Kurento",
          "Screenshots are deleted when the server restarts (they're in memory)"
        ],
        active_shares: []
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch screen shares" });
    }
  });
  
  // Get test case templates (admin only)
  app.get("/api/admin/test-cases/:subject", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const subject = req.params.subject;
      
      // Default test cases for prime number challenge
      const defaultTestCases = [
        { id: "1", input: "7", expected: "true", description: "Check if 7 is prime" },
        { id: "2", input: "4", expected: "false", description: "Check if 4 is prime" },
        { id: "3", input: "13", expected: "true", description: "Check if 13 is prime" },
        { id: "4", input: "1", expected: "false", description: "Check if 1 is prime" }
      ];
      
      res.json(defaultTestCases);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch test cases" });
    }
  });
  
  // Save test cases (admin only)
  app.post("/api/admin/test-cases/:subject", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const subject = req.params.subject;
      const testCases = req.body.testCases;
      
      if (!Array.isArray(testCases)) {
        return res.status(400).json({ message: "Invalid test cases format" });
      }
      
      console.log(`Saving ${testCases.length} test cases for ${subject}`);
      
      // In a real implementation, you would save these to the database
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to save test cases" });
    }
  });
  
  // Get all submissions (admin only)
  app.get("/api/submissions", isAuthenticated, checkRole("admin"), async (req, res) => {
    const submissions = await storage.getSubmissions();
    res.json(submissions);
  });
  
  // Get user's submissions
  app.get("/api/submissions/user", isAuthenticated, async (req, res) => {
    const submissions = await storage.getSubmissionsByUserId(req.user?.id!);
    res.json(submissions);
  });
  
  // Logging endpoints
  // Tab switch logging
  app.post("/api/log/tab-switch", isAuthenticated, async (req, res) => {
    try {
      const log = insertLogSchema.parse({
        userId: req.user?.id,
        type: "tab-switch",
        data: JSON.stringify(req.body)
      });
      
      const result = await storage.createLog(log);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: "Invalid log data" });
    }
  });
  
  // Screenshot logging
  app.post("/api/log/screenshot", isAuthenticated, async (req, res) => {
    try {
      const log = insertLogSchema.parse({
        userId: req.user?.id,
        type: "screenshot",
        data: req.body.image
      });
      
      const result = await storage.createLog(log);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: "Invalid log data" });
    }
  });
  
  // Screen share logging
  app.post("/api/log/screen-share", isAuthenticated, async (req, res) => {
    try {
      const log = insertLogSchema.parse({
        userId: req.user?.id,
        type: "screen-share",
        data: JSON.stringify(req.body)
      });
      
      const result = await storage.createLog(log);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: "Invalid log data" });
    }
  });
  
  // Get all logs (admin only)
  app.get("/api/logs", isAuthenticated, checkRole("admin"), async (req, res) => {
    const logs = await storage.getLogs();
    res.json(logs);
  });
  
  // Get logs by type (admin only)
  app.get("/api/logs/type/:type", isAuthenticated, checkRole("admin"), async (req, res) => {
    const logs = await storage.getLogsByType(req.params.type);
    res.json(logs);
  });

  // 🚀 Spin up a new container
// ...existing code...
// 🚀 Spin up a new container
app.post("/api/container/spin-up", isAuthenticated, async (req, res) => {
  const { language } = req.body;
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }
    // spinUpContainer will throw if the language is not supported
    const { url, containerId } = await spinUpContainer(language, req.user.id);
    res.json({ url, containerId });
  } catch (error: any) {
    console.error(error);
    // 400 for unsupported language, 500 for other errors
    if (error.message && error.message.startsWith("No Docker image defined")) {
      res.status(400).json({ message: "Unsupported language" });
    } else {
      res.status(500).json({ message: error.message || "Failed to spin up container" });
    }
  }
});

// 🛑 Stop a running container
app.post("/api/container/stop", isAuthenticated, async (req, res) => {
  const { containerId } = req.body;
  try {
    await stopContainer(containerId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to stop container" });
  }
});

  const httpServer = createServer(app);
  return httpServer;
}
