export interface Screenshot {
  _id?: string;
  userId: number;
  type: 'screenshot';
  image: string; // base64 encoded image
  metadata: ScreenshotMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScreenshotMetadata {
  timestamp: string;
  captureMethod: 'puppeteer-server-side' | 'client-side' | 'html2canvas-dom-fallback';
  containerUrl: string;
  subject: string;
  filename: string;
  captureEvent: 'submission' | 'manual' | 'periodic' | 'auto';
  screenResolution: {
    width: number;
    height: number;
  };
  fileSize: number; // in KB
  isCodespaceCapture: boolean;
  captureQuality: 'low' | 'medium' | 'high';
  pageTitle?: string;
  userAgent?: string;
  sessionId?: string;
  error?: string;
}

export interface ScreenshotQuery {
  userId?: number;
  captureMethod?: string;
  captureEvent?: string;
  subject?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
}

export interface ScreenshotStats {
  totalScreenshots: number;
  totalSize: number; // in KB
  averageSize: number; // in KB
  captureMethodBreakdown: Record<string, number>;
  captureEventBreakdown: Record<string, number>;
  subjectBreakdown: Record<string, number>;
  latestScreenshot?: Date;
  oldestScreenshot?: Date;
}

// MongoDB collection name
export const SCREENSHOT_COLLECTION = 'screenshots';

// Index definitions for MongoDB
export const SCREENSHOT_INDEXES = [
  { userId: 1, 'metadata.timestamp': -1 },
  { 'metadata.captureEvent': 1 },
  { 'metadata.captureMethod': 1 },
  { 'metadata.subject': 1 },
  { 'metadata.timestamp': -1 },
  { userId: 1, 'metadata.subject': 1, 'metadata.timestamp': -1 }
];

// Helper functions
export class ScreenshotModel {
  static createScreenshot(data: Omit<Screenshot, '_id' | 'createdAt' | 'updatedAt'>): Screenshot {
    return {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  static validateScreenshot(data: any): data is Screenshot {
    return (
      data &&
      typeof data.userId === 'number' &&
      data.type === 'screenshot' &&
      typeof data.image === 'string' &&
      data.metadata &&
      typeof data.metadata.timestamp === 'string' &&
      typeof data.metadata.containerUrl === 'string' &&
      typeof data.metadata.subject === 'string' &&
      typeof data.metadata.filename === 'string' &&
      typeof data.metadata.captureEvent === 'string' &&
      typeof data.metadata.screenResolution === 'object' &&
      typeof data.metadata.fileSize === 'number' &&
      typeof data.metadata.isCodespaceCapture === 'boolean'
    );
  }

  static sanitizeForStorage(screenshot: Screenshot): Screenshot {
    // Remove sensitive data if needed
    return {
      ...screenshot,
      metadata: {
        ...screenshot.metadata,
        // Could remove userAgent or other sensitive data here if needed
      }
    };
  }

  static getFileExtension(captureMethod: string): string {
    switch (captureMethod) {
      case 'puppeteer-server-side':
        return '.jpg';
      case 'client-side':
      case 'html2canvas-dom-fallback':
        return '.png';
      default:
        return '.jpg';
    }
  }

  static estimateImageSize(base64Image: string): number {
    // Estimate actual image size from base64 (accounting for base64 overhead)
    const base64Length = base64Image.replace(/^data:image\/[a-z]+;base64,/, '').length;
    return Math.round((base64Length * 3) / 4 / 1024); // Convert to KB
  }
} 