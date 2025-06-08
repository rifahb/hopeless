import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { spinUpContainer, stopContainer } from "./container-manager";
import { mongoService } from "./mongodb";
import { puppeteerService } from "./utils/capture.js";
import { 
  insertSubmissionSchema,
  insertLogSchema 
} from "@shared/schema";
import { z } from "zod";
import path from "path";
import fs from "fs";

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
  
  // Code submissions endpoint - Enhanced with Puppeteer screenshot capture
  app.post("/api/submit", isAuthenticated, async (req, res) => {
    try {
      const submission = insertSubmissionSchema.parse({
        userId: req.user?.id,
        subject: req.body.subject,
        code: req.body.code
      });
      
      // Save the code submission first
      const result = await storage.createSubmission(submission);
      
      // Capture Puppeteer screenshot on submission (asynchronously)
      const userId = req.user?.id!;
      const subject = req.body.subject;
      const containerUrl = `http://localhost:${8080 + userId}`;
      
      console.log(`📸 Triggering Puppeteer screenshot on submission for user ${userId}`);
      
      // Capture screenshot asynchronously to not block submission response
      puppeteerService.captureAndSaveToMongoDB(containerUrl, userId, subject, 'submission')
        .then(async screenshotResult => {
          if (screenshotResult.success) {
            console.log(`✅ Submission screenshot captured via Puppeteer for user ${userId}`);
            
            // Also log to SQLite for Event Logs tab
            try {
              const log = insertLogSchema.parse({
                userId: userId,
                type: "screenshot",
                data: JSON.stringify({
                  method: 'puppeteer-server-side',
                  containerUrl: containerUrl,
                  filename: screenshotResult.filename,
                  imageSize: screenshotResult.imageSize,
                  timestamp: screenshotResult.timestamp,
                  subject: subject,
                  captureEvent: 'submission'
                })
              });
              await storage.createLog(log);
              console.log(`📝 Submission screenshot logged to Event Logs for user ${userId}`);
            } catch (logError) {
              console.error('Failed to log submission screenshot to Event Logs:', logError);
            }
          } else {
            console.error(`❌ Puppeteer screenshot failed for user ${userId}:`, screenshotResult.error);
          }
        })
        .catch(error => {
          console.error(`❌ Puppeteer capture error for user ${userId}:`, error);
        });
      
      res.status(201).json({
        ...result,
        screenshotCaptured: true,
        message: "Code submitted successfully. High-quality screenshot capture initiated via Puppeteer."
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid submission data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to submit code" });
      }
    }
  });

  // Enhanced Puppeteer screenshot capture endpoint
  app.post("/api/capture-screenshot", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id!;
      const { subject, containerUrl } = req.body;
      
      // Use provided URL or construct default
      const targetUrl = containerUrl || `http://localhost:${8080 + userId}`;
      
      console.log(`📸 Manual Puppeteer screenshot requested for user ${userId}: ${targetUrl}`);
      
      const result = await puppeteerService.captureAndSaveToMongoDB(
        targetUrl, 
        userId, 
        subject || 'manual', 
        'manual'
      );
      
      if (result.success) {
        // Also log to SQLite for Event Logs tab
        try {
          const log = insertLogSchema.parse({
            userId: userId,
            type: "screenshot",
            data: JSON.stringify({
              method: 'puppeteer-server-side',
              containerUrl: targetUrl,
              filename: result.filename,
              imageSize: result.imageSize,
              timestamp: result.timestamp,
              subject: subject || 'manual',
              captureEvent: 'manual',
              captureType: result.captureType || 'browser'
            })
          });
          await storage.createLog(log);
          console.log(`📝 Puppeteer screenshot logged to Event Logs for user ${userId}`);
        } catch (logError) {
          console.error('Failed to log Puppeteer screenshot to Event Logs:', logError);
        }

        res.json({
          success: true,
          message: "High-quality screenshot captured via Puppeteer and saved to MongoDB Atlas",
          timestamp: result.timestamp,
          filename: result.filename,
          imageSize: result.imageSize,
          captureMethod: 'puppeteer-server-side',
          captureType: result.captureType || 'browser'
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Puppeteer screenshot capture failed",
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('Puppeteer screenshot endpoint error:', error);
      res.status(500).json({
        success: false,
        message: "Puppeteer screenshot capture failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Desktop screen capture endpoint (captures entire system screen)
  app.post("/api/capture-desktop", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id!;
      const { subject } = req.body;
      
      console.log(`🖥️ Desktop screen capture requested for user ${userId}`);
      
      const result = await puppeteerService.captureDesktopAndSaveToMongoDB(
        userId, 
        subject || 'desktop', 
        'manual'
      );
      
      if (result.success) {
        // Also log to SQLite for Event Logs tab
        try {
          const log = insertLogSchema.parse({
            userId: userId,
            type: "screenshot",
            data: JSON.stringify({
              method: 'puppeteer-server-side',
              containerUrl: 'desktop-capture',
              filename: result.filename,
              imageSize: result.imageSize,
              timestamp: result.timestamp,
              subject: subject || 'desktop',
              captureEvent: 'manual',
              captureType: 'desktop'
            })
          });
          await storage.createLog(log);
          console.log(`📝 Desktop screenshot logged to Event Logs for user ${userId}`);
        } catch (logError) {
          console.error('Failed to log desktop screenshot to Event Logs:', logError);
        }

        res.json({
          success: true,
          message: "Desktop screen captured successfully and saved to MongoDB Atlas",
          timestamp: result.timestamp,
          filename: result.filename,
          imageSize: result.imageSize,
          captureMethod: 'puppeteer-server-side',
          captureType: 'desktop'
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Desktop screen capture failed",
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('Desktop capture endpoint error:', error);
      res.status(500).json({
        success: false,
        message: "Desktop screen capture failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bulk screenshot capture for all active users (admin only)
  app.post("/api/admin/capture-all-screenshots", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      // This would capture screenshots for all active codespaces
      // Implementation would depend on how you track active containers
      const activeUsers = [1, 2, 3]; // Example - you'd get this from your container tracking
      
      const capturePromises = activeUsers.map(userId => {
        const containerUrl = `http://localhost:${8080 + userId}`;
        return puppeteerService.captureAndSaveToMongoDB(
          containerUrl, 
          userId, 
          'admin-capture', 
          'admin-bulk'
        );
      });
      
      const results = await Promise.allSettled(capturePromises);
      
      const summary = {
        total: results.length,
        successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
        failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length
      };
      
      res.json({
        success: true,
        message: "Bulk screenshot capture completed",
        summary,
        results: results.map((r, i) => ({
          userId: activeUsers[i],
          status: r.status,
          ...(r.status === 'fulfilled' ? { result: r.value } : { error: r.reason })
        }))
      });
      
    } catch (error) {
      console.error('Bulk screenshot capture error:', error);
      res.status(500).json({
        success: false,
        message: "Bulk screenshot capture failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
        message: "Enhanced monitoring with Puppeteer screenshots",
        note: "System now uses Puppeteer for high-quality codespace screenshots",
        details: [
          "Screenshots are captured server-side using Puppeteer",
          "Real codespace content is captured (not placeholders)",
          "Images are stored in MongoDB Atlas with metadata",
          "Automatic capture on code submission",
          "Manual capture available for students",
          "Admin bulk capture functionality"
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
  
  // Logging endpoints (keeping for backward compatibility but prioritizing Puppeteer)
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
  
  // Legacy screenshot logging (client-side) - deprecated in favor of Puppeteer
  app.post("/api/log/screenshot", isAuthenticated, async (req, res) => {
    try {
      console.log("⚠️ Client-side screenshot received - consider using Puppeteer endpoint instead");
      
      // Validate image format
      const imageData = req.body.image;
      if (!imageData || typeof imageData !== 'string') {
        return res.status(400).json({ 
          message: "Invalid screenshot: missing or invalid image data",
          error: "IMAGE_DATA_MISSING"
        });
      }
      
      if (!imageData.startsWith('data:image/')) {
        console.error('❌ Screenshot received without proper data URI prefix');
        return res.status(400).json({ 
          message: "Invalid screenshot: image must include data URI prefix (data:image/...)",
          error: "INVALID_IMAGE_FORMAT",
          receivedPrefix: imageData.substring(0, 30)
        });
      }
      
      console.log(`📸 Screenshot validation: ✅ Valid format - ${imageData.substring(0, 30)}...`);
      console.log(`📸 Screenshot size: ${Math.round(imageData.length/1024)}KB`);
      
      // Save to MongoDB with structured data (marking as legacy)
      const screenshotData = {
        userId: req.user?.id!,
        type: 'screenshot' as const,
        image: imageData, // Store the full base64 string with prefix
        metadata: {
          ...req.body.metadata,
          captureMethod: 'client-side-legacy',
          imageDataValidated: true,
          receivedAt: new Date().toISOString()
        }
      };
      
      const result = await mongoService.saveScreenshot(screenshotData);
      
      // Also save to hybrid storage (MongoDB via storage interface)
      const log = insertLogSchema.parse({
        userId: req.user?.id,
        type: "screenshot",
        data: JSON.stringify({
          image: imageData, // Ensure full image data is stored
          metadata: {
            ...req.body.metadata,
            imageDataValidated: true
          }
        })
      });
      await storage.createLog(log);
      
      res.status(201).json({
        ...result,
        message: "Screenshot saved successfully with validated format",
        imageSize: Math.round(imageData.length/1024),
        warning: "Client-side screenshot - consider using Puppeteer for better quality"
      });
    } catch (error) {
      console.error('Screenshot logging error:', error);
      res.status(400).json({ 
        message: "Invalid log data", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Screenshot error logging
  app.post("/api/log/screenshot-error", isAuthenticated, async (req, res) => {
    try {
      const log = insertLogSchema.parse({
        userId: req.user?.id,
        type: "screenshot-error",
        data: JSON.stringify(req.body)
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
      // Save to MongoDB with structured data
      const screenShareData = {
        userId: req.user?.id!,
        type: 'screen-share' as const,
        action: req.body.action,
        timestamp: req.body.timestamp,
        streamInfo: req.body.streamInfo,
        error: req.body.error
      };
      
      const result = await mongoService.saveScreenShareEvent(screenShareData);
      
      // Also save to hybrid storage (MongoDB via storage interface)
      const log = insertLogSchema.parse({
        userId: req.user?.id,
        type: "screen-share",
        data: JSON.stringify(req.body)
      });
      await storage.createLog(log);
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Screen share logging error:', error);
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

  // Serve screenshot images from MongoDB (admin only)
  app.get("/api/screenshots/:filename", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Security check: ensure filename doesn't contain path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      
      console.log(`📸 Looking for screenshot in MongoDB: ${filename}`);
      
      // Try to find the screenshot in MongoDB by filename
      const screenshots = await mongoService.getAllScreenshots();
      let targetScreenshot = null;
      
      // First, try exact filename match
      targetScreenshot = screenshots.find(shot => 
        shot.metadata?.filename === filename
      );
      
      // If not found, try to find by similar pattern (same user ID)
      if (!targetScreenshot) {
        const userMatch = filename.match(/user-(\d+)/);
        const userId = userMatch ? parseInt(userMatch[1]) : null;
        
        if (userId) {
          console.log(`📸 Looking for fallback screenshot for user ${userId}`);
          targetScreenshot = screenshots.find(shot => 
            shot.userId === userId && shot.metadata?.captureMethod === 'puppeteer-server-side'
          );
        }
      }
      
      if (targetScreenshot && targetScreenshot.image) {
        console.log(`📸 Found screenshot in MongoDB for ${filename}`);
        
        // Extract base64 data from data URI
        let imageData = targetScreenshot.image;
        
        // Handle different image data formats
        if (imageData.startsWith('data:image/')) {
          const base64Data = imageData.split(',')[1];
          const mimeType = imageData.split(';')[0].split(':')[1];
          
          // Convert base64 to buffer
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Set appropriate headers
          res.set({
            'Content-Type': mimeType,
            'Content-Length': imageBuffer.length,
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'X-Screenshot-Source': 'mongodb',
            'X-Original-Filename': targetScreenshot.metadata?.filename || filename
          });
          
          // Send the image
          res.send(imageBuffer);
          
          console.log(`📸 Served screenshot from MongoDB: ${filename} (${Math.round(imageBuffer.length/1024)}KB)`);
          return;
        }
      }
      
      // Fallback: try to serve from local files if MongoDB doesn't have it
      console.log(`📸 Screenshot not found in MongoDB, trying local files...`);
      
      const screenshotsDir = path.join(process.cwd(), 'screenshots');
      const filePath = path.join(screenshotsDir, filename);
      
      if (fs.existsSync(filePath)) {
        console.log(`📸 Found screenshot in local files: ${filename}`);
        
        const stats = fs.statSync(filePath);
        const fileExtension = path.extname(filename).toLowerCase();
        
        let contentType = 'image/jpeg';
        if (fileExtension === '.png') {
          contentType = 'image/png';
        } else if (fileExtension === '.webp') {
          contentType = 'image/webp';
        }
        
        res.set({
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Cache-Control': 'public, max-age=86400',
          'Last-Modified': stats.mtime.toUTCString(),
          'X-Screenshot-Source': 'local-file'
        });
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
        console.log(`📸 Served screenshot from local file: ${filename} (${Math.round(stats.size/1024)}KB)`);
        return;
      }
      
      // Not found anywhere
      console.log(`❌ Screenshot not found: ${filename}`);
      console.log(`📊 Available screenshots in MongoDB: ${screenshots.length}`);
      
      res.status(404).json({ 
        message: "Screenshot not found",
        requestedFile: filename,
        availableInMongoDB: screenshots.length,
        availableFilenames: screenshots
          .filter(shot => shot.metadata?.filename)
          .map(shot => shot.metadata.filename)
          .slice(0, 5) // Show first 5 as example
      });
      
    } catch (error) {
      console.error('Error serving screenshot:', error);
      res.status(500).json({ message: "Failed to serve screenshot" });
    }
  });

  // MongoDB-based endpoints for enhanced monitoring
  
  // Get screenshots from MongoDB (admin only)
  app.get("/api/mongodb/screenshots", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const screenshots = await mongoService.getScreenshots();
      res.json(screenshots);
    } catch (error) {
      console.error("Error fetching MongoDB screenshots:", error);
      res.status(500).json({ message: "Failed to fetch screenshots" });
    }
  });

  // Get screen share events from MongoDB (admin only)
  app.get("/api/mongodb/screen-shares", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      const screenShares = await mongoService.getScreenShareEvents(userId, limit);
      res.json(screenShares);
    } catch (error) {
      console.error('Error fetching screen shares:', error);
      res.status(500).json({ message: "Failed to fetch screen shares" });
    }
  });

  // Get active screen shares (admin only)
  app.get("/api/mongodb/active-screen-shares", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const activeShares = await mongoService.getActiveScreenShares();
      res.json(activeShares);
    } catch (error) {
      console.error('Error fetching active screen shares:', error);
      res.status(500).json({ message: "Failed to fetch active screen shares" });
    }
  });

  // Get monitoring statistics (admin only)
  app.get("/api/mongodb/stats", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const stats = await mongoService.getMonitoringStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching monitoring stats:', error);
      res.status(500).json({ message: "Failed to fetch monitoring stats" });
    }
  });

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

  // Clear ALL logs from both SQLite and MongoDB (admin only)
  app.post("/api/admin/clear-all-logs", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      console.log('🗑️ Admin requested to clear ALL logs from both databases');
      
      let sqliteCount = 0;
      let mongoCount = 0;
      
      // 1. Clear logs from SQLite/Hybrid storage
      try {
        const logs = await storage.getLogs();
        sqliteCount = logs.length;
        
        // Delete all logs by type
        await storage.deleteLogsByType('screenshot');
        await storage.deleteLogsByType('tab-switch');
        await storage.deleteLogsByType('screen-share');
        await storage.deleteLogsByType('screenshot-error');
        
        console.log(`✅ Cleared ${sqliteCount} logs from SQLite/Hybrid storage`);
      } catch (sqliteError) {
        console.error('Error clearing SQLite logs:', sqliteError);
      }
      
      // 2. Clear logs directly from MongoDB
      try {
        const db = mongoService['db'];
        if (db) {
          const logsCollection = db.collection('logs');
          const mongoResult = await logsCollection.deleteMany({});
          mongoCount = mongoResult.deletedCount || 0;
          console.log(`✅ Cleared ${mongoCount} logs directly from MongoDB logs collection`);
        }
      } catch (mongoError) {
        console.error('Error clearing MongoDB logs:', mongoError);
      }
      
      // 3. Also clear corrupted screenshot events
      try {
        // Clear any remaining corrupted data
        const db = mongoService['db'];
        if (db) {
          // Clear any logs that might have corrupted screenshot data
          const corruptedResult = await db.collection('logs').deleteMany({
            $or: [
              { type: 'screenshot', 'data.image': { $exists: true } },
              { type: 'screenshot', data: { $regex: 'data:image' } }
            ]
          });
          console.log(`✅ Cleared ${corruptedResult.deletedCount} potentially corrupted screenshot logs`);
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      
      console.log(`🎯 Total cleanup: ${sqliteCount} SQLite + ${mongoCount} MongoDB logs cleared`);
      
      res.json({
        success: true,
        message: `Cleared all logs: ${sqliteCount} from SQLite + ${mongoCount} from MongoDB`,
        sqliteCount,
        mongoCount,
        totalCleared: sqliteCount + mongoCount
      });
      
    } catch (error) {
      console.error('Clear all logs error:', error);
      res.status(500).json({
        success: false,
        message: "Failed to clear logs",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test screenshot endpoint for debugging (admin only)
  app.post("/api/admin/test-screenshot", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      console.log('🧪 Test screenshot endpoint called');
      
      // Capture a simple screenshot of Google for testing
      const result = await puppeteerService.captureAndSaveToMongoDB(
        'https://www.google.com',
        999, // Test user ID
        'test-screenshot',
        'manual'
      );
      
      if (result.success) {
        console.log('✅ Test screenshot captured and saved successfully');
        
        // Also log to SQLite for Event Logs tab
        try {
          const log = insertLogSchema.parse({
            userId: 999, // Test user ID
            type: "screenshot",
            data: JSON.stringify({
              method: 'puppeteer-server-side',
              containerUrl: 'https://www.google.com',
              filename: result.filename,
              imageSize: result.imageSize,
              timestamp: result.timestamp,
              subject: 'test-screenshot',
              captureEvent: 'admin-test',
              captureType: result.captureType || 'browser'
            })
          });
          await storage.createLog(log);
          console.log(`📝 Test screenshot logged to Event Logs`);
        } catch (logError) {
          console.error('Failed to log test screenshot to Event Logs:', logError);
        }
        
        res.json({
          success: true,
          message: "Test screenshot captured and saved to MongoDB",
          result
        });
      } else {
        console.error('❌ Test screenshot failed:', result.error);
        res.status(500).json({
          success: false,
          message: "Test screenshot failed",
          error: result.error
        });
      }
    } catch (error) {
      console.error('Test screenshot endpoint error:', error);
      res.status(500).json({
        success: false,
        message: "Test screenshot endpoint failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Admin desktop capture endpoint (admin can capture any user's desktop)
  app.post("/api/admin/capture-desktop", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { userId, subject } = req.body;
      const targetUserId = userId || 999; // Default test user
      
      console.log(`🖥️ Admin desktop capture requested for user ${targetUserId}`);
      
      const result = await puppeteerService.captureDesktopAndSaveToMongoDB(
        targetUserId, 
        subject || 'admin-desktop', 
        'admin-capture'
      );
      
      if (result.success) {
        console.log('✅ Admin desktop capture successful');
        
        // Also log to SQLite for Event Logs tab
        try {
          const log = insertLogSchema.parse({
            userId: targetUserId,
            type: "screenshot",
            data: JSON.stringify({
              method: 'puppeteer-server-side',
              containerUrl: 'desktop-capture',
              filename: result.filename,
              imageSize: result.imageSize,
              timestamp: result.timestamp,
              subject: subject || 'admin-desktop',
              captureEvent: 'admin-capture',
              captureType: 'desktop'
            })
          });
          await storage.createLog(log);
          console.log(`📝 Admin desktop capture logged to Event Logs`);
        } catch (logError) {
          console.error('Failed to log admin desktop capture to Event Logs:', logError);
        }
        
        res.json({
          success: true,
          message: "Admin desktop capture successful and saved to MongoDB",
          result
        });
      } else {
        console.error('❌ Admin desktop capture failed:', result.error);
        res.status(500).json({
          success: false,
          message: "Admin desktop capture failed",
          error: result.error
        });
      }
    } catch (error) {
      console.error('Admin desktop capture endpoint error:', error);
      res.status(500).json({
        success: false,
        message: "Admin desktop capture failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

    // Debug endpoint for testing screenshot capture (admin only)
  app.post("/api/debug/capture-screenshot", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { containerUrl, userId, subject } = req.body;
      
      if (!containerUrl || !userId) {
        return res.status(400).json({ message: "containerUrl and userId are required" });
      }
      
      console.log(`🔧 DEBUG: Manual screenshot capture test`);
      console.log(`🔧 URL: ${containerUrl}`);
      console.log(`🔧 User: ${userId}`);
      console.log(`🔧 Subject: ${subject || 'debug'}`);
      
      // Use the updated Puppeteer service for screenshot capture
      const result = await puppeteerService.captureAndSaveToMongoDB(
        containerUrl, 
        parseInt(userId), 
        subject || 'debug',
        'debug-manual'
      );
      
      console.log(`🔧 DEBUG: Screenshot result:`, result);
      
      if (result.success) {
          console.log(`🔧 DEBUG: Screenshot captured and saved to MongoDB successfully`);
        } else {
          console.error(`🔧 DEBUG: Screenshot capture failed:`, result.error);
        }
      
      res.json({
        success: result.success,
        message: result.success ? "Debug screenshot captured successfully" : "Screenshot capture failed",
        result: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('🔧 DEBUG: Screenshot capture error:', error);
      res.status(500).json({ 
        message: "Debug screenshot capture failed", 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Debug endpoint to cleanup orphaned browser processes (admin only)
  app.post("/api/debug/cleanup-browsers", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      console.log('🧹 Manual browser cleanup requested by admin');
      
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        
        // Check for Chrome processes
        exec('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV', (error, stdout) => {
          if (!error) {
            const chromeProcesses = stdout.split('\n').filter(line => line.includes('chrome.exe')).length - 1;
            
            if (chromeProcesses > 0) {
              console.log(`🔫 Found ${chromeProcesses} Chrome processes, killing them...`);
              exec('taskkill /F /IM chrome.exe /T', (killError) => {
                if (!killError) {
                  console.log('✅ Chrome processes cleaned up');
                } else {
                  console.error('❌ Failed to kill Chrome processes:', killError);
                }
              });
            } else {
              console.log('✅ No orphaned Chrome processes found');
            }
          }
        });
      }
      
      // Also cleanup the Puppeteer service
      await puppeteerService.cleanup();
      
      res.json({
        success: true,
        message: "Browser cleanup initiated",
        platform: process.platform,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Browser cleanup error:', error);
      res.status(500).json({
        success: false,
        message: "Failed to cleanup browsers",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Debug endpoint to check workspace state (admin only)
  app.post("/api/debug/workspace-state", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { containerUrl } = req.body;
      
      if (!containerUrl) {
        return res.status(400).json({ message: "containerUrl is required" });
      }
      
      console.log(`🔧 DEBUG: Checking workspace state for ${containerUrl}`);
      
      const browser = await puppeteerService.initBrowser();
      const page = await browser.newPage();
      
      await page.goto(containerUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Check login
      const needsLogin = await page.$('input[type="password"]');
      if (needsLogin) {
        await page.type('input[type="password"]', 'cs1234');
        await page.keyboard.press('Enter');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Get workspace state
      const workspaceState = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.tab .label-name')).map(tab => tab.textContent);
        const editorContent = document.querySelector('.monaco-editor .view-lines')?.textContent?.substring(0, 200) || '';
        const welcomeScreen = document.querySelector('[aria-label="Get Started"], .welcome-view') ? true : false;
        const explorerFiles = Array.from(document.querySelectorAll('.explorer-viewlet .label-name')).map(file => file.textContent);
        const notifications = Array.from(document.querySelectorAll('.notification-toast')).map(n => n.textContent);
        
        return {
          tabs,
          editorContent,
          welcomeScreen,
          explorerFiles,
          notifications,
          hasMonacoEditor: !!document.querySelector('.monaco-editor'),
          hasWorkbench: !!document.querySelector('.monaco-workbench'),
          url: window.location.href,
          title: document.title
        };
      });
      
      await page.close();
      
      res.json({
        success: true,
        workspaceState,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('🔧 DEBUG: Workspace state check error:', error);
      res.status(500).json({ 
        message: "Failed to check workspace state", 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get system screen information (admin only)
  app.get("/api/debug/system-info", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      console.log('🖥️ Getting system screen information...');
      
      const puppeteer = await import('puppeteer');
      
      // Launch temporary browser to get screen info
      const browser = await puppeteer.default.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      const systemInfo = await page.evaluate(() => {
        return {
          screen: {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth
          },
          window: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
            devicePixelRatio: window.devicePixelRatio
          },
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        };
      });
      
      await browser.close();
      
      console.log('🖥️ System info collected:', systemInfo);
      
      res.json({
        success: true,
        systemInfo: systemInfo,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('🖥️ Error getting system info:', error);
      res.status(500).json({ 
        message: "Failed to get system information", 
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
