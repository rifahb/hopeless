import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

// Legacy screenshot format for backward compatibility
interface LegacyScreenshotLog {
  _id?: ObjectId;
  userId: number;
  type: 'screenshot';
  image: string;
  metadata: {
    timestamp: string;
    captureNumber: number;
    screenResolution: { width: number; height: number };
    viewportSize: { width: number; height: number };
    userAgent: string;
    url: string;
    sessionId: string;
    codespaceActive: boolean;
    captureMethod?: string;
  };
  createdAt: Date;
}

// New Puppeteer screenshot format
interface PuppeteerScreenshotLog {
  _id?: ObjectId;
  userId: number;
  type: 'screenshot';
  image: string;
  metadata: {
    timestamp: string;
    captureMethod: 'puppeteer-server-side';
    containerUrl: string;
    subject: string;
    filename: string;
    captureEvent: 'submission' | 'manual' | 'admin-bulk' | 'admin-capture';
    screenResolution: { width: number; height: number };
    fileSize: number;
    isCodespaceCapture: boolean;
    captureQuality: string;
    captureType: 'browser' | 'desktop';
    pageTitle?: string;
    userAgent?: string;
    sessionId?: string;
  };
  createdAt: Date;
}

// Union type for all screenshot formats
type ScreenshotLog = LegacyScreenshotLog | PuppeteerScreenshotLog;

interface ScreenShareLog {
  _id?: ObjectId;
  userId: number;
  type: 'screen-share';
  action: 'start' | 'stop' | 'error';
  timestamp: string;
  streamInfo?: {
    videoTracks: number;
    audioTracks: number;
    streamId: string;
  };
  error?: string;
  createdAt: Date;
}

interface MonitoringLog {
  _id?: ObjectId;
  userId: number;
  type: string;
  data: any;
  timestamp: string;
  createdAt: Date;
}

class MongoDBService {
  private client: MongoClient;
  private db: Db;
  private isConnected: boolean = false;

  constructor() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI environment variable is required');
    }

    // MongoDB client options for better connection handling
    this.client = new MongoClient(mongoUri, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      },
      ssl: true,
      retryWrites: true,
      w: 'majority',
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000,
    });
    this.db = this.client.db('coding_lab_monitoring');
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('📦 Connected to MongoDB successfully');
      
      // Create indexes for better performance
      await this.createIndexes();
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('📦 Disconnected from MongoDB');
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      const screenshotsCollection = this.db.collection('screenshots');
      const screenShareCollection = this.db.collection('screen_shares');
      const logsCollection = this.db.collection('logs');

      // Create indexes for efficient querying
      await screenshotsCollection.createIndex({ userId: 1, createdAt: -1 });
      await screenshotsCollection.createIndex({ 'metadata.timestamp': -1 });
      
      await screenShareCollection.createIndex({ userId: 1, createdAt: -1 });
      await screenShareCollection.createIndex({ action: 1, createdAt: -1 });
      
      await logsCollection.createIndex({ userId: 1, type: 1, createdAt: -1 });
      
      console.log('📑 MongoDB indexes created successfully');
    } catch (error) {
      console.error('⚠️ Failed to create indexes:', error);
    }
  }

  // Screenshot methods
  async saveScreenshot(screenshotData: Omit<ScreenshotLog, '_id' | 'createdAt'>): Promise<ScreenshotLog> {
    const collection: Collection<ScreenshotLog> = this.db.collection('screenshots');
    
    // Validate image data before saving
    if (!screenshotData.image || typeof screenshotData.image !== 'string') {
      throw new Error('Invalid screenshot: image data is missing or not a string');
    }
    
    if (!screenshotData.image.startsWith('data:image/')) {
      console.warn('⚠️ Screenshot received without proper data URI prefix, rejecting save');
      throw new Error('Invalid screenshot: image must include data URI prefix (data:image/...)');
    }
    
    console.log(`📸 Screenshot validation passed: ${screenshotData.image.substring(0, 30)}...`);
    console.log(`📸 Screenshot size: ${Math.round(screenshotData.image.length/1024)}KB`);
    
    const document: ScreenshotLog = {
      ...screenshotData,
      createdAt: new Date()
    };

    const result = await collection.insertOne(document);
    
    const savedDoc = await collection.findOne({ _id: result.insertedId });
    if (!savedDoc) {
      throw new Error('Failed to retrieve saved screenshot');
    }

    // Log appropriately based on screenshot type
    if ('containerUrl' in screenshotData.metadata) {
      // Puppeteer screenshot
      console.log(`🚀 Puppeteer screenshot saved for user ${screenshotData.userId}, event: ${screenshotData.metadata.captureEvent}`);
    } else {
      // Legacy screenshot
      const legacyData = screenshotData as Omit<LegacyScreenshotLog, '_id' | 'createdAt'>;
      console.log(`📸 Legacy screenshot saved for user ${screenshotData.userId}, capture #${legacyData.metadata.captureNumber}`);
    }
    
    return savedDoc;
  }

  async getScreenshots(userId?: number, limit: number = 100): Promise<ScreenshotLog[]> {
    const collection: Collection<ScreenshotLog> = this.db.collection('screenshots');
    
    const query = userId ? { userId } : {};
    const screenshots = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return screenshots;
  }

  async getAllScreenshots(): Promise<ScreenshotLog[]> {
    const collection: Collection<ScreenshotLog> = this.db.collection('screenshots');
    
    const screenshots = await collection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return screenshots;
  }

  async getScreenshotsByDateRange(startDate: Date, endDate: Date, userId?: number): Promise<ScreenshotLog[]> {
    const collection: Collection<ScreenshotLog> = this.db.collection('screenshots');
    
    const query: any = {
      createdAt: { $gte: startDate, $lte: endDate }
    };
    
    if (userId) {
      query.userId = userId;
    }

    return await collection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
  }

  // Screen Share methods
  async saveScreenShareEvent(shareData: Omit<ScreenShareLog, '_id' | 'createdAt'>): Promise<ScreenShareLog> {
    const collection: Collection<ScreenShareLog> = this.db.collection('screen_shares');
    
    const document: ScreenShareLog = {
      ...shareData,
      createdAt: new Date()
    };

    const result = await collection.insertOne(document);
    
    const savedDoc = await collection.findOne({ _id: result.insertedId });
    if (!savedDoc) {
      throw new Error('Failed to retrieve saved screen share event');
    }

    console.log(`🎥 Screen share ${shareData.action} saved for user ${shareData.userId}`);
    return savedDoc;
  }

  async getScreenShareEvents(userId?: number, limit: number = 100): Promise<ScreenShareLog[]> {
    const collection: Collection<ScreenShareLog> = this.db.collection('screen_shares');
    
    const query = userId ? { userId } : {};
    return await collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async getActiveScreenShares(): Promise<ScreenShareLog[]> {
    const collection: Collection<ScreenShareLog> = this.db.collection('screen_shares');
    
    // Find users who have started sharing but haven't stopped yet
    const pipeline = [
      { $sort: { createdAt: -1 } },
      { 
        $group: {
          _id: '$userId',
          lastEvent: { $first: '$$ROOT' }
        }
      },
      { 
        $match: {
          'lastEvent.action': 'start'
        }
      },
      { $replaceRoot: { newRoot: '$lastEvent' } }
    ];

    return await collection.aggregate(pipeline).toArray();
  }

  // General logging methods
  async saveLog(logData: Omit<MonitoringLog, '_id' | 'createdAt'>): Promise<MonitoringLog> {
    const collection: Collection<MonitoringLog> = this.db.collection('logs');
    
    const document: MonitoringLog = {
      ...logData,
      createdAt: new Date()
    };

    const result = await collection.insertOne(document);
    
    const savedDoc = await collection.findOne({ _id: result.insertedId });
    if (!savedDoc) {
      throw new Error('Failed to retrieve saved log');
    }

    return savedDoc;
  }

  async getLogs(type?: string, userId?: number, limit: number = 100): Promise<MonitoringLog[]> {
    const collection: Collection<MonitoringLog> = this.db.collection('logs');
    
    const query: any = {};
    if (type) query.type = type;
    if (userId) query.userId = userId;

    return await collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  // Statistics methods
  async getMonitoringStats(): Promise<{
    totalScreenshots: number;
    totalScreenShares: number;
    activeScreenShares: number;
    totalLogs: number;
  }> {
    const [
      totalScreenshots,
      totalScreenShares,
      activeScreenShares,
      totalLogs
    ] = await Promise.all([
      this.db.collection('screenshots').countDocuments(),
      this.db.collection('screen_shares').countDocuments(),
      (await this.getActiveScreenShares()).length,
      this.db.collection('logs').countDocuments()
    ]);

    return {
      totalScreenshots,
      totalScreenShares,
      activeScreenShares,
      totalLogs
    };
  }
}

// Create singleton instance
export const mongoService = new MongoDBService();

// Export types for use in other files
export type { ScreenshotLog, ScreenShareLog, MonitoringLog }; 